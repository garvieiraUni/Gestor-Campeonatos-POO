import { NaoEncontradoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import { EstadoInscricao, InscricaoAprovada, StatusInscricao } from './estado-inscricao';
import { Jogador, JogadorSnapshot } from './jogador';

export interface EquipeSnapshot {
  id: Id;
  nome: string;
  jogadores: JogadorSnapshot[];
  /** Conta do espectador que inscreveu o time; null quando foi um organizador. */
  responsavelId: Id | null;
  status: StatusInscricao;
  motivoRecusa: string | null;
}

/** Equipe inscrita em um campeonato, com o seu elenco e o estado da inscrição. */
export class Equipe {
  readonly id: Id;
  readonly responsavelId: Id | null;
  private _nome: string;
  private readonly _jogadores: Jogador[];
  private inscricao: EstadoInscricao;

  private constructor(id: Id, nome: string, jogadores: Jogador[], responsavelId: Id | null, inscricao: EstadoInscricao) {
    this.id = id;
    this._nome = Equipe.validarNome(nome);
    this._jogadores = jogadores;
    this.responsavelId = responsavelId;
    this.inscricao = inscricao;
  }

  /** Por padrão a equipe nasce aprovada (inscrita por um organizador). */
  static criar(nome: string, opcoes: { responsavelId?: Id | null; inscricao?: EstadoInscricao } = {}): Equipe {
    return new Equipe(novoId(), nome, [], opcoes.responsavelId ?? null, opcoes.inscricao ?? new InscricaoAprovada());
  }

  static restaurar(s: EquipeSnapshot): Equipe {
    return new Equipe(
      s.id,
      s.nome,
      s.jogadores.map(Jogador.restaurar),
      s.responsavelId ?? null,
      EstadoInscricao.de(s.status ?? 'APROVADA', s.motivoRecusa ?? null),
    );
  }

  private static validarNome(nome: string): string {
    const n = nome?.trim();
    garantir(n && n.length >= 2, 'O nome da equipe precisa ter pelo menos 2 caracteres');
    return n;
  }

  get nome(): string {
    return this._nome;
  }
  get jogadores(): readonly Jogador[] {
    return this._jogadores;
  }
  get status(): StatusInscricao {
    return this.inscricao.status;
  }
  get aprovada(): boolean {
    return this.inscricao.aprovada;
  }
  get pendente(): boolean {
    return this.status === 'PENDENTE';
  }
  get recusada(): boolean {
    return this.status === 'RECUSADA';
  }
  get motivoRecusa(): string | null {
    return this.inscricao.motivoRecusa;
  }

  ehDe(usuarioId: Id): boolean {
    return this.responsavelId === usuarioId;
  }

  // ---------- inscrição (State) ----------

  aprovar(): void {
    this.inscricao = this.inscricao.aprovar();
  }

  recusar(motivo: string): void {
    this.inscricao = this.inscricao.recusar(motivo);
  }

  /** Volta a pedir a entrada com um novo nome e um novo elenco (já validados pelo Campeonato). */
  reenviar(destino: EstadoInscricao, nome: string, jogadores: Jogador[]): void {
    const novo = this.inscricao.reenviar(destino);
    this._nome = Equipe.validarNome(nome);
    this._jogadores.splice(0, this._jogadores.length, ...jogadores);
    this.inscricao = novo;
  }

  // ---------- elenco ----------

  /** R1 (limite máximo) + camisa única dentro da equipe. */
  adicionarJogador(jogador: Jogador, maximoDeJogadores: number): void {
    if (this._jogadores.length >= maximoDeJogadores) {
      throw new RegraDeNegocioError(`A equipe ${this.nome} já atingiu o limite de ${maximoDeJogadores} jogadores`);
    }
    if (this._jogadores.some((j) => j.numero === jogador.numero)) {
      throw new RegraDeNegocioError(`A camisa ${jogador.numero} já está em uso na equipe ${this.nome}`);
    }
    this._jogadores.push(jogador);
  }

  removerJogador(jogadorId: Id): void {
    const i = this._jogadores.findIndex((j) => j.id === jogadorId);
    if (i < 0) throw new NaoEncontradoError('Jogador não encontrado nesta equipe');
    this._jogadores.splice(i, 1);
  }

  possuiJogador(jogadorId: Id): boolean {
    return this._jogadores.some((j) => j.id === jogadorId);
  }

  possuiDocumento(documento: string): boolean {
    return this._jogadores.some((j) => j.documento.toLowerCase() === documento.toLowerCase());
  }

  buscarJogador(jogadorId: Id): Jogador | undefined {
    return this._jogadores.find((j) => j.id === jogadorId);
  }

  snapshot(): EquipeSnapshot {
    return {
      id: this.id,
      nome: this.nome,
      jogadores: this._jogadores.map((j) => j.snapshot()),
      responsavelId: this.responsavelId,
      status: this.status,
      motivoRecusa: this.motivoRecusa,
    };
  }
}
