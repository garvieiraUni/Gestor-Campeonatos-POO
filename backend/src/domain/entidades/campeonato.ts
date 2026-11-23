import { NaoEncontradoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import { LinhaTabela } from '../desempate/linha-tabela';
import { AvancoDeFase, ControleDisciplinar, ObservadorDePartida } from '../disciplina/observadores';
import { Suspensao, SuspensaoSnapshot } from '../disciplina/suspensao';
import { EventoPartida, TipoEvento } from '../eventos/evento-partida';
import { FormatoFactory } from '../formatos/formato-factory';
import { ContextoFormato, FormatoTorneio } from '../formatos/formato-torneio';
import { Equipe, EquipeSnapshot } from './equipe';
import { EstadoCampeonato, StatusCampeonato } from './estado-campeonato';
import { Fase, FaseSnapshot } from './fase';
import { Jogador } from './jogador';
import { Partida, Placar } from './partida';
import { Regulamento, RegulamentoProps } from './regulamento';

export const MAXIMO_DE_EQUIPES = 32;

export interface CampeonatoSnapshot {
  id: Id;
  nome: string;
  descricao: string;
  modalidade: string;
  organizadorId: Id;
  status: StatusCampeonato;
  regulamento: RegulamentoProps;
  equipes: EquipeSnapshot[];
  fases: FaseSnapshot[];
  suspensoes: SuspensaoSnapshot[];
  campeaoId: Id | null;
  criadoEm: string;
}

export interface LinhaArtilharia {
  jogadorId: Id;
  nome: string;
  equipeId: Id;
  equipe: string;
  gols: number;
}

/**
 * Raiz do agregado. Toda alteração em equipes, partidas e suspensões passa por aqui,
 * o que garante que nenhuma regra seja pulada.
 */
export class Campeonato {
  readonly id: Id;
  readonly nome: string;
  readonly descricao: string;
  readonly modalidade: string;
  readonly organizadorId: Id;
  readonly regulamento: Regulamento;
  readonly criadoEm: Date;
  private estado: EstadoCampeonato;
  private readonly _equipes: Equipe[];
  private readonly _fases: Fase[];
  private readonly _suspensoes: Suspensao[];
  private _campeaoId: Id | null;
  private readonly observadores: ObservadorDePartida[];

  private constructor(s: CampeonatoSnapshot, observadores?: ObservadorDePartida[]) {
    const nome = s.nome?.trim();
    garantir(nome && nome.length >= 3, 'O nome do campeonato precisa ter pelo menos 3 caracteres');
    this.id = s.id;
    this.nome = nome;
    this.descricao = s.descricao?.trim() ?? '';
    this.modalidade = s.modalidade?.trim() || 'Futebol';
    this.organizadorId = s.organizadorId;
    this.regulamento = Regulamento.criar(s.regulamento);
    this.criadoEm = new Date(s.criadoEm);
    this.estado = EstadoCampeonato.de(s.status);
    this._equipes = s.equipes.map(Equipe.restaurar);
    this._fases = s.fases.map(Fase.restaurar).sort((a, b) => a.ordem - b.ordem);
    this._suspensoes = s.suspensoes.map(Suspensao.restaurar);
    this._campeaoId = s.campeaoId;
    // a ordem importa: primeiro suspensões, depois avanço de fase
    this.observadores = observadores ?? [new ControleDisciplinar(), new AvancoDeFase()];
  }

  static criar(dados: {
    nome: string;
    organizadorId: Id;
    descricao?: string;
    modalidade?: string;
    regulamento?: Partial<RegulamentoProps>;
  }): Campeonato {
    return new Campeonato({
      id: novoId(),
      nome: dados.nome,
      descricao: dados.descricao ?? '',
      modalidade: dados.modalidade ?? 'Futebol',
      organizadorId: dados.organizadorId,
      status: 'INSCRICOES_ABERTAS',
      regulamento: Regulamento.criar(dados.regulamento).snapshot(),
      equipes: [],
      fases: [],
      suspensoes: [],
      campeaoId: null,
      criadoEm: new Date().toISOString(),
    });
  }

  static restaurar(s: CampeonatoSnapshot): Campeonato {
    return new Campeonato(s);
  }

  // ---------- leitura ----------

  get status(): StatusCampeonato {
    return this.estado.status;
  }
  get equipes(): readonly Equipe[] {
    return this._equipes;
  }
  get fases(): readonly Fase[] {
    return this._fases;
  }
  get suspensoes(): readonly Suspensao[] {
    return this._suspensoes;
  }
  get campeaoId(): Id | null {
    return this._campeaoId;
  }
  get faseAtual(): Fase | undefined {
    return this._fases[this._fases.length - 1];
  }
  get formato(): FormatoTorneio {
    return FormatoFactory.criar(this.regulamento.formato);
  }

  ehOrganizador(usuarioId: Id): boolean {
    return this.organizadorId === usuarioId;
  }

  obterEquipe(equipeId: Id): Equipe {
    const e = this._equipes.find((x) => x.id === equipeId);
    if (!e) throw new NaoEncontradoError('Equipe não encontrada neste campeonato');
    return e;
  }

  equipeDoJogador(jogadorId: Id): Equipe | undefined {
    return this._equipes.find((e) => e.possuiJogador(jogadorId));
  }

  obterPartida(partidaId: Id): Partida {
    for (const f of this._fases) {
      const p = f.buscarPartida(partidaId);
      if (p) return p;
    }
    throw new NaoEncontradoError('Partida não encontrada neste campeonato');
  }

  todasAsPartidas(): Partida[] {
    return this._fases.flatMap((f) => [...f.partidas]);
  }

  // ---------- inscrições (R1, R2, R3) ----------

  inscreverEquipe(nome: string): Equipe {
    this.estado.garantirInscricoesAbertas();
    const equipe = Equipe.criar(nome);
    if (this._equipes.some((e) => e.nome.toLowerCase() === equipe.nome.toLowerCase())) {
      throw new RegraDeNegocioError(`Já existe uma equipe chamada ${equipe.nome} neste campeonato`);
    }
    if (this._equipes.length >= MAXIMO_DE_EQUIPES) {
      throw new RegraDeNegocioError(`O campeonato aceita no máximo ${MAXIMO_DE_EQUIPES} equipes`);
    }
    this._equipes.push(equipe);
    return equipe;
  }

  removerEquipe(equipeId: Id): void {
    this.estado.garantirInscricoesAbertas();
    const equipe = this.obterEquipe(equipeId);
    this._equipes.splice(this._equipes.indexOf(equipe), 1);
  }

  adicionarJogador(
    equipeId: Id,
    dados: { nome: string; numero: number; documento: string; posicao?: string | null },
  ): Jogador {
    this.estado.garantirInscricoesAbertas();
    const equipe = this.obterEquipe(equipeId);
    const jogador = Jogador.criar(dados);
    // R2: o mesmo jogador (documento) não pode estar em duas equipes do campeonato
    const outra = this._equipes.find((e) =>
      e.jogadores.some((j) => j.documento.toLowerCase() === jogador.documento.toLowerCase()),
    );
    if (outra) {
      throw new RegraDeNegocioError(`O documento ${jogador.documento} já está inscrito na equipe ${outra.nome}`);
    }
    equipe.adicionarJogador(jogador, this.regulamento.props.maxJogadores);
    return jogador;
  }

  removerJogador(equipeId: Id, jogadorId: Id): void {
    this.estado.garantirInscricoesAbertas();
    this.obterEquipe(equipeId).removerJogador(jogadorId);
  }

  /** Fecha as inscrições e gera a primeira fase com todas as rodadas. */
  iniciar(): void {
    const proximo = this.estado.iniciar(); // lança erro se não estiver em inscrições
    garantir(this._equipes.length >= 2, 'São necessárias pelo menos 2 equipes para iniciar');
    const min = this.regulamento.props.minJogadores;
    for (const e of this._equipes) {
      if (e.jogadores.length < min) {
        throw new RegraDeNegocioError(`A equipe ${e.nome} tem ${e.jogadores.length} jogadores; o mínimo é ${min}`);
      }
    }
    const formato = this.formato;
    formato.validarInicio(this._equipes.length, this.regulamento.props);
    this._fases.push(formato.gerarFaseInicial(this.contextoDoFormato()));
    this.estado = proximo;
  }

  // ---------- súmula ----------

  iniciarPartida(partidaId: Id): void {
    this.estado.garantirEmAndamento();
    this.obterPartida(partidaId).iniciar();
  }

  registrarEvento(partidaId: Id, dados: { tipo: TipoEvento; jogadorId: Id; minuto: number }): EventoPartida[] {
    this.estado.garantirEmAndamento();
    const partida = this.obterPartida(partidaId);
    const equipe = this.equipeDoJogador(dados.jogadorId);
    if (!equipe) throw new NaoEncontradoError('Jogador não encontrado neste campeonato');
    return partida.registrarEvento(dados.tipo, dados.jogadorId, equipe.id, dados.minuto, {
      jogadorSuspenso: this.estaSuspenso(dados.jogadorId, partidaId),
    });
  }

  removerEvento(partidaId: Id, eventoId: Id): void {
    this.estado.garantirEmAndamento();
    this.obterPartida(partidaId).removerEvento(eventoId);
  }

  finalizarPartida(partidaId: Id, penaltis?: Placar | null): void {
    this.estado.garantirEmAndamento();
    const partida = this.obterPartida(partidaId);
    partida.finalizar(penaltis);
    for (const o of this.observadores) o.aoFinalizarPartida(partida, this); // Observer
  }

  // ---------- usados pelos observadores ----------

  estaSuspenso(jogadorId: Id, partidaId: Id): boolean {
    return this._suspensoes.some((s) => s.jogadorId === jogadorId && s.valePara(partidaId));
  }

  /** Amarelos válidos para acúmulo: os de partidas em que o jogador não foi expulso. */
  amarelosAcumuladosDo(jogadorId: Id): number {
    return this.todasAsPartidas()
      .filter((p) => p.finalizada && !p.foiExpulso(jogadorId))
      .reduce((soma, p) => soma + p.amarelosDo(jogadorId), 0);
  }

  aplicarSuspensao(s: Suspensao): void {
    this._suspensoes.push(s);
  }

  adicionarFase(fase: Fase): void {
    this.estado.garantirEmAndamento();
    this._fases.push(fase);
  }

  encerrar(campeaoId: Id): void {
    this.estado = this.estado.encerrar();
    this._campeaoId = campeaoId;
  }

  contextoDoFormato(): ContextoFormato {
    return {
      equipes: this._equipes.map((e) => ({ id: e.id, nome: e.nome })),
      classificacao: this.regulamento.criarClassificacao(),
      regulamento: this.regulamento.props,
    };
  }

  // ---------- consultas ----------

  /** Tabela de cada grupo das fases de pontos (pontos corridos ou grupos). */
  tabelas(): { faseId: Id; fase: string; grupo: string; linhas: LinhaTabela[] }[] {
    const classificacao = this.regulamento.criarClassificacao();
    return this._fases
      .filter((f) => !f.eliminatoria)
      .flatMap((f) =>
        f.grupos.map((g) => ({
          faseId: f.id,
          fase: f.nome,
          grupo: g.nome,
          linhas: classificacao.calcular(
            this._equipes.filter((e) => g.equipeIds.includes(e.id)),
            f.partidasDoGrupo(g.nome),
          ),
        })),
      );
  }

  artilharia(): LinhaArtilharia[] {
    const gols = new Map<Id, number>();
    for (const p of this.todasAsPartidas()) {
      for (const e of p.eventos) if (e.tipo === 'GOL') gols.set(e.jogadorId, (gols.get(e.jogadorId) ?? 0) + 1);
    }
    const linhas: LinhaArtilharia[] = [];
    for (const [jogadorId, total] of gols) {
      const equipe = this.equipeDoJogador(jogadorId);
      const jogador = equipe?.buscarJogador(jogadorId);
      if (!equipe || !jogador) continue;
      linhas.push({ jogadorId, nome: jogador.nome, equipeId: equipe.id, equipe: equipe.nome, gols: total });
    }
    return linhas.sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  snapshot(): CampeonatoSnapshot {
    return {
      id: this.id,
      nome: this.nome,
      descricao: this.descricao,
      modalidade: this.modalidade,
      organizadorId: this.organizadorId,
      status: this.status,
      regulamento: this.regulamento.snapshot(),
      equipes: this._equipes.map((e) => e.snapshot()),
      fases: this._fases.map((f) => f.snapshot()),
      suspensoes: this._suspensoes.map((s) => s.snapshot()),
      campeaoId: this._campeaoId,
      criadoEm: this.criadoEm.toISOString(),
    };
  }
}
