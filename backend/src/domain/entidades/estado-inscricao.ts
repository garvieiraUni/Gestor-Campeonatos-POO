import { TransicaoInvalidaError, garantir } from '../compartilhado/erros';

export type StatusInscricao = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

/**
 * State pattern da inscrição de um time (mesmo molde de EstadoPartida).
 * Pendente → Aprovada | Recusada;  Recusada → (reenviar) → Pendente ou Aprovada.
 */
export abstract class EstadoInscricao {
  abstract readonly status: StatusInscricao;
  protected abstract readonly descricao: string;

  get motivoRecusa(): string | null {
    return null;
  }

  get aprovada(): boolean {
    return this.status === 'APROVADA';
  }

  aprovar(): EstadoInscricao {
    throw new TransicaoInvalidaError(`Não é possível aprovar uma inscrição ${this.descricao}`);
  }

  recusar(_motivo: string): EstadoInscricao {
    throw new TransicaoInvalidaError(`Não é possível recusar uma inscrição ${this.descricao}`);
  }

  /** `destino` vem do modo de inscrição do campeonato (pendente ou já aprovada). */
  reenviar(_destino: EstadoInscricao): EstadoInscricao {
    throw new TransicaoInvalidaError(`Só uma inscrição recusada pode ser reenviada; esta está ${this.descricao}`);
  }

  static de(status: StatusInscricao, motivo: string | null = null): EstadoInscricao {
    switch (status) {
      case 'PENDENTE':
        return new InscricaoPendente();
      case 'APROVADA':
        return new InscricaoAprovada();
      case 'RECUSADA':
        return new InscricaoRecusada(motivo ?? '');
    }
  }
}

export class InscricaoPendente extends EstadoInscricao {
  readonly status = 'PENDENTE' as const;
  protected readonly descricao = 'pendente';

  aprovar(): EstadoInscricao {
    return new InscricaoAprovada();
  }

  recusar(motivo: string): EstadoInscricao {
    return new InscricaoRecusada(motivo);
  }
}

export class InscricaoAprovada extends EstadoInscricao {
  readonly status = 'APROVADA' as const;
  protected readonly descricao = 'já aprovada';
}

export class InscricaoRecusada extends EstadoInscricao {
  readonly status = 'RECUSADA' as const;
  protected readonly descricao = 'recusada';
  private readonly motivo: string;

  constructor(motivo: string) {
    super();
    const m = motivo?.trim() ?? '';
    garantir(m.length >= 3 && m.length <= 300, 'Informe o motivo da recusa (de 3 a 300 caracteres)');
    this.motivo = m;
  }

  get motivoRecusa(): string {
    return this.motivo;
  }

  reenviar(destino: EstadoInscricao): EstadoInscricao {
    return destino;
  }
}
