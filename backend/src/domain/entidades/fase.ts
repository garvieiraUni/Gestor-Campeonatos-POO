import { NaoEncontradoError } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import { Partida, PartidaSnapshot } from './partida';

export type TipoFase = 'PONTOS_CORRIDOS' | 'GRUPOS' | 'MATA_MATA';

export interface Grupo {
  nome: string;
  equipeIds: Id[];
}

export interface FaseSnapshot {
  id: Id;
  nome: string;
  tipo: TipoFase;
  ordem: number;
  grupos: Grupo[];
  partidas: PartidaSnapshot[];
}

export class Fase {
  readonly id: Id;
  readonly nome: string;
  readonly tipo: TipoFase;
  readonly ordem: number;
  readonly grupos: readonly Grupo[];
  private readonly _partidas: Partida[];

  private constructor(id: Id, nome: string, tipo: TipoFase, ordem: number, grupos: Grupo[], partidas: Partida[]) {
    this.id = id;
    this.nome = nome;
    this.tipo = tipo;
    this.ordem = ordem;
    this.grupos = grupos;
    this._partidas = partidas;
  }

  static criar(dados: { nome: string; tipo: TipoFase; ordem: number; grupos?: Grupo[]; partidas: Partida[] }): Fase {
    return new Fase(novoId(), dados.nome, dados.tipo, dados.ordem, dados.grupos ?? [], dados.partidas);
  }

  static restaurar(s: FaseSnapshot): Fase {
    return new Fase(s.id, s.nome, s.tipo, s.ordem, s.grupos, s.partidas.map(Partida.restaurar));
  }

  get partidas(): readonly Partida[] {
    return this._partidas;
  }

  get eliminatoria(): boolean {
    return this.tipo === 'MATA_MATA';
  }

  /** Uma fase termina quando todas as partidas estão finalizadas. */
  completa(): boolean {
    return this._partidas.length > 0 && this._partidas.every((p) => p.finalizada);
  }

  partidasDoGrupo(nome: string): Partida[] {
    return this._partidas.filter((p) => p.grupo === nome);
  }

  buscarPartida(id: Id): Partida | undefined {
    return this._partidas.find((p) => p.id === id);
  }

  obterPartida(id: Id): Partida {
    const p = this.buscarPartida(id);
    if (!p) throw new NaoEncontradoError('Partida não encontrada');
    return p;
  }

  snapshot(): FaseSnapshot {
    return {
      id: this.id,
      nome: this.nome,
      tipo: this.tipo,
      ordem: this.ordem,
      grupos: this.grupos.map((g) => ({ nome: g.nome, equipeIds: [...g.equipeIds] })),
      partidas: this._partidas.map((p) => p.snapshot()),
    };
  }
}
