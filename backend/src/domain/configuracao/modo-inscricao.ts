import { RegraDeNegocioError } from '../compartilhado/erros';
import { EstadoInscricao, InscricaoAprovada, InscricaoPendente } from '../entidades/estado-inscricao';

export type TipoModoInscricao = 'LIVRE' | 'COM_APROVACAO' | 'FECHADA';
export const TIPOS_MODO_INSCRICAO: readonly TipoModoInscricao[] = ['LIVRE', 'COM_APROVACAO', 'FECHADA'];

/**
 * Strategy: como um espectador entra no campeonato.
 * O Campeonato pergunta ao modo qual é o estado inicial da inscrição, sem if por tipo.
 */
export abstract class ModoDeInscricao {
  abstract readonly tipo: TipoModoInscricao;
  abstract aceitaInscricaoDeEspectador(): boolean;

  /** Estado em que o time do espectador nasce (ou erro, se o modo não aceita). */
  abstract estadoInicialParaEspectador(): EstadoInscricao;

  static de(tipo: TipoModoInscricao): ModoDeInscricao {
    switch (tipo) {
      case 'LIVRE':
        return new InscricaoLivre();
      case 'COM_APROVACAO':
        return new InscricaoComAprovacao();
      case 'FECHADA':
        return new InscricaoFechada();
      default:
        throw new RegraDeNegocioError(`Modo de inscrição desconhecido: ${String(tipo)}`);
    }
  }
}

/** O time do espectador entra direto. */
export class InscricaoLivre extends ModoDeInscricao {
  readonly tipo = 'LIVRE' as const;
  aceitaInscricaoDeEspectador(): boolean {
    return true;
  }
  estadoInicialParaEspectador(): EstadoInscricao {
    return new InscricaoAprovada();
  }
}

/** O time do espectador espera um organizador aprovar. */
export class InscricaoComAprovacao extends ModoDeInscricao {
  readonly tipo = 'COM_APROVACAO' as const;
  aceitaInscricaoDeEspectador(): boolean {
    return true;
  }
  estadoInicialParaEspectador(): EstadoInscricao {
    return new InscricaoPendente();
  }
}

/** Só os organizadores inscrevem times. */
export class InscricaoFechada extends ModoDeInscricao {
  readonly tipo = 'FECHADA' as const;
  aceitaInscricaoDeEspectador(): boolean {
    return false;
  }
  estadoInicialParaEspectador(): EstadoInscricao {
    throw new RegraDeNegocioError('As inscrições deste campeonato são fechadas: só os organizadores inscrevem times');
  }
}
