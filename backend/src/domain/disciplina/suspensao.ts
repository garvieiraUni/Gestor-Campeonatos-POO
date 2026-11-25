import { RegraDeNegocioError } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';

export type MotivoSuspensao = 'ACUMULO_DE_AMARELOS' | 'CARTAO_VERMELHO';

export interface SuspensaoSnapshot {
  id: Id;
  jogadorId: Id;
  equipeId: Id;
  motivo: MotivoSuspensao;
  partidaOrigemId: Id;
  jogos: number;
  partidasCumpridas: Id[];
}

export class Suspensao {
  private constructor(private readonly s: SuspensaoSnapshot) {}

  static aplicar(dados: Omit<SuspensaoSnapshot, 'id' | 'partidasCumpridas'>): Suspensao {
    return new Suspensao({ ...dados, id: novoId(), partidasCumpridas: [] });
  }

  static restaurar(s: SuspensaoSnapshot): Suspensao {
    return new Suspensao({ ...s, partidasCumpridas: [...s.partidasCumpridas] });
  }

  get id(): Id {
    return this.s.id;
  }
  get jogadorId(): Id {
    return this.s.jogadorId;
  }
  get equipeId(): Id {
    return this.s.equipeId;
  }
  get motivo(): MotivoSuspensao {
    return this.s.motivo;
  }
  get partidaOrigemId(): Id {
    return this.s.partidaOrigemId;
  }
  get jogos(): number {
    return this.s.jogos;
  }
  get partidasCumpridas(): readonly Id[] {
    return this.s.partidasCumpridas;
  }

  get jogosRestantes(): number {
    return this.s.jogos - this.s.partidasCumpridas.length;
  }

  get ativa(): boolean {
    return this.jogosRestantes > 0;
  }

  /** A suspensão vale para as partidas seguintes à que a originou. */
  valePara(partidaId: Id): boolean {
    return this.ativa && partidaId !== this.s.partidaOrigemId;
  }

  cumprirEm(partidaId: Id): void {
    if (!this.ativa) throw new RegraDeNegocioError('Suspensão já foi cumprida');
    this.s.partidasCumpridas.push(partidaId);
  }

  snapshot(): SuspensaoSnapshot {
    return { ...this.s, partidasCumpridas: [...this.s.partidasCumpridas] };
  }
}
