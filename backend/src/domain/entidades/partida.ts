import { JogadorSuspensoError, NaoEncontradoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import {
  CartaoVermelho,
  EstatisticasPartida,
  EventoFactory,
  EventoPartida,
  EventoSnapshot,
  TipoEvento,
} from '../eventos/evento-partida';
import { EstadoPartida, StatusPartida } from './estado-partida';

export type Resultado = 'VITORIA' | 'EMPATE' | 'DERROTA';

export interface Placar {
  mandante: number;
  visitante: number;
}

export interface PartidaSnapshot {
  id: Id;
  rodada: number;
  /** Nome do grupo (fases de pontos) ou null (mata-mata). */
  grupo: string | null;
  /** Posição no chaveamento: os vencedores das posições 2k e 2k+1 se enfrentam depois. */
  posicao: number;
  mandanteId: Id;
  visitanteId: Id;
  eliminatoria: boolean;
  status: StatusPartida;
  eventos: EventoSnapshot[];
  penaltis: Placar | null;
}

/** O que a Partida precisa saber do campeonato para validar um evento. */
export interface ContextoDoEvento {
  jogadorSuspenso: boolean;
}

export class Partida {
  readonly id: Id;
  readonly rodada: number;
  readonly grupo: string | null;
  readonly posicao: number;
  readonly mandanteId: Id;
  readonly visitanteId: Id;
  readonly eliminatoria: boolean;
  private estado: EstadoPartida;
  private readonly _eventos: EventoPartida[];
  private _penaltis: Placar | null;

  private constructor(s: PartidaSnapshot) {
    garantir(s.mandanteId !== s.visitanteId, 'Uma equipe não pode enfrentar a si mesma');
    this.id = s.id;
    this.rodada = s.rodada;
    this.grupo = s.grupo;
    this.posicao = s.posicao;
    this.mandanteId = s.mandanteId;
    this.visitanteId = s.visitanteId;
    this.eliminatoria = s.eliminatoria;
    this.estado = EstadoPartida.de(s.status);
    this._eventos = s.eventos.map(EventoFactory.restaurar);
    this._penaltis = s.penaltis;
  }

  static agendar(dados: {
    rodada: number;
    mandanteId: Id;
    visitanteId: Id;
    grupo?: string | null;
    posicao?: number;
    eliminatoria?: boolean;
  }): Partida {
    return new Partida({
      id: novoId(),
      rodada: dados.rodada,
      grupo: dados.grupo ?? null,
      posicao: dados.posicao ?? 0,
      mandanteId: dados.mandanteId,
      visitanteId: dados.visitanteId,
      eliminatoria: dados.eliminatoria ?? false,
      status: 'AGENDADA',
      eventos: [],
      penaltis: null,
    });
  }

  static restaurar(s: PartidaSnapshot): Partida {
    return new Partida(s);
  }

  get status(): StatusPartida {
    return this.estado.status;
  }

  get finalizada(): boolean {
    return this.status === 'FINALIZADA';
  }

  get eventos(): readonly EventoPartida[] {
    return this._eventos;
  }

  get penaltis(): Placar | null {
    return this._penaltis;
  }

  envolve(equipeId: Id): boolean {
    return this.mandanteId === equipeId || this.visitanteId === equipeId;
  }

  adversarioDe(equipeId: Id): Id {
    return equipeId === this.mandanteId ? this.visitanteId : this.mandanteId;
  }

  iniciar(): void {
    this.estado = this.estado.iniciar();
  }

  /**
   * Registra um evento na súmula. Retorna os eventos criados: um segundo amarelo
   * gera também o vermelho automaticamente.
   */
  registrarEvento(tipo: TipoEvento, jogadorId: Id, equipeId: Id, minuto: number, ctx: ContextoDoEvento): EventoPartida[] {
    this.estado.garantirQueAceitaEventos();
    // R12: só jogadores das duas equipes da partida
    if (!this.envolve(equipeId)) {
      throw new RegraDeNegocioError('O jogador não pertence a nenhuma das equipes desta partida');
    }
    // R11: suspenso não participa
    if (ctx.jogadorSuspenso) {
      throw new JogadorSuspensoError('Jogador cumpre suspensão nesta partida');
    }
    if (this.foiExpulso(jogadorId)) {
      throw new RegraDeNegocioError('Jogador já foi expulso desta partida');
    }

    const evento = EventoFactory.criar(tipo, jogadorId, equipeId, minuto);
    this._eventos.push(evento);
    const criados = [evento];

    // Segundo amarelo na mesma partida = expulsão
    if (tipo === 'CARTAO_AMARELO' && this.amarelosDo(jogadorId) === 2) {
      const vermelho = new CartaoVermelho(novoId(), jogadorId, equipeId, minuto, true);
      this._eventos.push(vermelho);
      criados.push(vermelho);
    }
    return criados;
  }

  removerEvento(eventoId: Id): void {
    this.estado.garantirQueAceitaEventos();
    const evento = this._eventos.find((e) => e.id === eventoId);
    if (!evento) throw new NaoEncontradoError('Evento não encontrado nesta partida');
    this._eventos.splice(this._eventos.indexOf(evento), 1);

    // Tirar um amarelo desfaz a expulsão automática que ele causou
    if (evento.tipo === 'CARTAO_AMARELO') {
      const automatico = this._eventos.find(
        (e) => e instanceof CartaoVermelho && e.segundoAmarelo && e.jogadorId === evento.jogadorId,
      );
      if (automatico) this._eventos.splice(this._eventos.indexOf(automatico), 1);
    }
  }

  /** R13: mata-mata não termina empatado; exige pênaltis com vencedor. */
  finalizar(penaltis?: Placar | null): void {
    const placar = this.placar();
    const empatou = placar.mandante === placar.visitante;
    if (this.eliminatoria && empatou) {
      if (!penaltis) {
        throw new RegraDeNegocioError('Partida eliminatória empatada: informe o resultado dos pênaltis');
      }
      garantir(
        Number.isInteger(penaltis.mandante) && Number.isInteger(penaltis.visitante) && penaltis.mandante >= 0 && penaltis.visitante >= 0,
        'Placar de pênaltis inválido',
      );
      garantir(penaltis.mandante !== penaltis.visitante, 'A disputa de pênaltis precisa ter um vencedor');
    }
    this.estado = this.estado.finalizar();
    this._penaltis = this.eliminatoria && empatou ? penaltis! : null;
  }

  estatisticas(): EstatisticasPartida {
    const est = new EstatisticasPartida();
    for (const e of this._eventos) e.aplicarEm(est); // polimorfismo
    return est;
  }

  placar(): Placar {
    const est = this.estatisticas();
    return { mandante: est.golsDe(this.mandanteId), visitante: est.golsDe(this.visitanteId) };
  }

  /** Resultado no tempo normal (é o que vale para a tabela). */
  resultadoPara(equipeId: Id): Resultado {
    const p = this.placar();
    const pro = equipeId === this.mandanteId ? p.mandante : p.visitante;
    const contra = equipeId === this.mandanteId ? p.visitante : p.mandante;
    if (pro > contra) return 'VITORIA';
    if (pro < contra) return 'DERROTA';
    return 'EMPATE';
  }

  /** Vencedor considerando pênaltis; null se ainda não terminou ou empatou numa fase de pontos. */
  vencedorId(): Id | null {
    if (!this.finalizada) return null;
    const p = this.placar();
    if (p.mandante !== p.visitante) return p.mandante > p.visitante ? this.mandanteId : this.visitanteId;
    if (this._penaltis) return this._penaltis.mandante > this._penaltis.visitante ? this.mandanteId : this.visitanteId;
    return null;
  }

  eventosDo(jogadorId: Id): EventoPartida[] {
    return this._eventos.filter((e) => e.jogadorId === jogadorId);
  }

  amarelosDo(jogadorId: Id): number {
    return this.eventosDo(jogadorId).filter((e) => e.tipo === 'CARTAO_AMARELO').length;
  }

  foiExpulso(jogadorId: Id): boolean {
    return this.eventosDo(jogadorId).some((e) => e.tipo === 'CARTAO_VERMELHO');
  }

  snapshot(): PartidaSnapshot {
    return {
      id: this.id,
      rodada: this.rodada,
      grupo: this.grupo,
      posicao: this.posicao,
      mandanteId: this.mandanteId,
      visitanteId: this.visitanteId,
      eliminatoria: this.eliminatoria,
      status: this.status,
      eventos: this._eventos.map((e) => e.snapshot()),
      penaltis: this._penaltis,
    };
  }
}
