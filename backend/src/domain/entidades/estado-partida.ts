import { TransicaoInvalidaError } from '../compartilhado/erros';

export type StatusPartida = 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA';

/**
 * State pattern: cada estado decide o que a partida pode fazer.
 * O comportamento padrão é recusar; cada subclasse libera só o que faz sentido.
 */
export abstract class EstadoPartida {
  abstract readonly status: StatusPartida;
  protected abstract readonly descricao: string;

  iniciar(): EstadoPartida {
    throw new TransicaoInvalidaError(`Não é possível iniciar uma partida ${this.descricao}`);
  }

  garantirQueAceitaEventos(): void {
    throw new TransicaoInvalidaError(`Não é possível alterar a súmula de uma partida ${this.descricao}`);
  }

  finalizar(): EstadoPartida {
    throw new TransicaoInvalidaError(`Não é possível finalizar uma partida ${this.descricao}`);
  }

  static de(status: StatusPartida): EstadoPartida {
    switch (status) {
      case 'AGENDADA':
        return new Agendada();
      case 'EM_ANDAMENTO':
        return new EmAndamento();
      case 'FINALIZADA':
        return new Finalizada();
    }
  }
}

export class Agendada extends EstadoPartida {
  readonly status = 'AGENDADA' as const;
  protected readonly descricao = 'agendada';

  iniciar(): EstadoPartida {
    return new EmAndamento();
  }
}

export class EmAndamento extends EstadoPartida {
  readonly status = 'EM_ANDAMENTO' as const;
  protected readonly descricao = 'em andamento';

  garantirQueAceitaEventos(): void {
    /* permitido */
  }

  finalizar(): EstadoPartida {
    return new Finalizada();
  }
}

/** R15: partida finalizada não aceita mais eventos. */
export class Finalizada extends EstadoPartida {
  readonly status = 'FINALIZADA' as const;
  protected readonly descricao = 'já finalizada';
}
