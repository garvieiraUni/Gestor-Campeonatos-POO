import { TransicaoInvalidaError } from '../compartilhado/erros';

export type StatusCampeonato = 'INSCRICOES_ABERTAS' | 'EM_ANDAMENTO' | 'ENCERRADO';

/** State pattern do campeonato (R3). */
export abstract class EstadoCampeonato {
  abstract readonly status: StatusCampeonato;
  protected abstract readonly descricao: string;

  garantirInscricoesAbertas(): void {
    throw new TransicaoInvalidaError(`As inscrições estão fechadas: o campeonato está ${this.descricao}`);
  }

  garantirEmAndamento(): void {
    throw new TransicaoInvalidaError(`O campeonato está ${this.descricao}`);
  }

  iniciar(): EstadoCampeonato {
    throw new TransicaoInvalidaError(`Não é possível iniciar: o campeonato está ${this.descricao}`);
  }

  encerrar(): EstadoCampeonato {
    throw new TransicaoInvalidaError(`Não é possível encerrar: o campeonato está ${this.descricao}`);
  }

  static de(status: StatusCampeonato): EstadoCampeonato {
    switch (status) {
      case 'INSCRICOES_ABERTAS':
        return new InscricoesAbertas();
      case 'EM_ANDAMENTO':
        return new CampeonatoEmAndamento();
      case 'ENCERRADO':
        return new Encerrado();
    }
  }
}

export class InscricoesAbertas extends EstadoCampeonato {
  readonly status = 'INSCRICOES_ABERTAS' as const;
  protected readonly descricao = 'com inscrições abertas';

  garantirInscricoesAbertas(): void {
    /* permitido */
  }

  iniciar(): EstadoCampeonato {
    return new CampeonatoEmAndamento();
  }
}

export class CampeonatoEmAndamento extends EstadoCampeonato {
  readonly status = 'EM_ANDAMENTO' as const;
  protected readonly descricao = 'em andamento';

  garantirEmAndamento(): void {
    /* permitido */
  }

  encerrar(): EstadoCampeonato {
    return new Encerrado();
  }
}

export class Encerrado extends EstadoCampeonato {
  readonly status = 'ENCERRADO' as const;
  protected readonly descricao = 'encerrado';
}
