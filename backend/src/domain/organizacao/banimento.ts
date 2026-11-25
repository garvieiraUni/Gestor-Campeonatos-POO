import { garantir } from '../compartilhado/erros';
import { Id } from '../compartilhado/id';

/** INSCRICAO: a conta não inscreve times. VISUALIZACAO: além disso, não vê o campeonato. */
export type NivelBanimento = 'INSCRICAO' | 'VISUALIZACAO';
export const NIVEIS_BANIMENTO: readonly NivelBanimento[] = ['INSCRICAO', 'VISUALIZACAO'];

export interface BanimentoSnapshot {
  usuarioId: Id;
  nivel: NivelBanimento;
  motivo: string;
  banidoPor: Id;
  banidoEm: string;
}

/** Value Object imutável: para mudar o nível, troca-se o banimento inteiro. */
export class Banimento {
  private constructor(private readonly s: Readonly<BanimentoSnapshot>) {}

  static aplicar(dados: Omit<BanimentoSnapshot, 'banidoEm'>): Banimento {
    const motivo = dados.motivo?.trim() ?? '';
    garantir(motivo.length <= 300, 'O motivo do banimento pode ter no máximo 300 caracteres');
    return new Banimento(Object.freeze({ ...dados, motivo, banidoEm: new Date().toISOString() }));
  }

  static restaurar(s: BanimentoSnapshot): Banimento {
    return new Banimento(Object.freeze({ ...s }));
  }

  get usuarioId(): Id {
    return this.s.usuarioId;
  }
  get nivel(): NivelBanimento {
    return this.s.nivel;
  }
  get motivo(): string {
    return this.s.motivo;
  }

  /** Qualquer banimento impede inscrever times. */
  impedeInscricao(): boolean {
    return true;
  }

  impedeVisualizacao(): boolean {
    return this.s.nivel === 'VISUALIZACAO';
  }

  snapshot(): BanimentoSnapshot {
    return { ...this.s };
  }
}
