import { NaoEncontradoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import { Jogador, JogadorSnapshot } from './jogador';

export interface EquipeSnapshot {
  id: Id;
  nome: string;
  jogadores: JogadorSnapshot[];
}

/** Equipe inscrita em um campeonato, com o seu elenco. */
export class Equipe {
  readonly id: Id;
  readonly nome: string;
  private readonly _jogadores: Jogador[];

  private constructor(id: Id, nome: string, jogadores: Jogador[]) {
    const n = nome?.trim();
    garantir(n && n.length >= 2, 'O nome da equipe precisa ter pelo menos 2 caracteres');
    this.id = id;
    this.nome = n;
    this._jogadores = jogadores;
  }

  static criar(nome: string): Equipe {
    return new Equipe(novoId(), nome, []);
  }

  static restaurar(s: EquipeSnapshot): Equipe {
    return new Equipe(s.id, s.nome, s.jogadores.map(Jogador.restaurar));
  }

  get jogadores(): readonly Jogador[] {
    return this._jogadores;
  }

  /** R1 (limite máximo) + camisa única dentro da equipe. */
  adicionarJogador(jogador: Jogador, maximoDeJogadores: number): void {
    if (this._jogadores.length >= maximoDeJogadores) {
      throw new RegraDeNegocioError(
        `A equipe ${this.nome} já atingiu o limite de ${maximoDeJogadores} jogadores`,
      );
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

  buscarJogador(jogadorId: Id): Jogador | undefined {
    return this._jogadores.find((j) => j.id === jogadorId);
  }

  snapshot(): EquipeSnapshot {
    return { id: this.id, nome: this.nome, jogadores: this._jogadores.map((j) => j.snapshot()) };
  }
}
