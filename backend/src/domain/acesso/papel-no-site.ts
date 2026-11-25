import { RegraDeNegocioError } from '../compartilhado/erros';

export type TipoPapelNoSite = 'ADM' | 'PADRAO';
export const TIPOS_PAPEL_NO_SITE: readonly TipoPapelNoSite[] = ['ADM', 'PADRAO'];

/**
 * Papel da conta no site inteiro (herança + polimorfismo).
 * Quem pergunta "esta conta tem acesso global?" não precisa de if por tipo.
 */
export abstract class PapelNoSite {
  abstract readonly tipo: TipoPapelNoSite;

  /** true = enxerga e altera qualquer campeonato. */
  abstract temAcessoGlobal(): boolean;

  static de(tipo: TipoPapelNoSite): PapelNoSite {
    switch (tipo) {
      case 'ADM':
        return new Administrador();
      case 'PADRAO':
        return new ContaPadrao();
      default:
        throw new RegraDeNegocioError(`Papel desconhecido: ${String(tipo)}`);
    }
  }
}

/** Desenvolvedores do site: podem tudo, em todos os campeonatos. */
export class Administrador extends PapelNoSite {
  readonly tipo = 'ADM' as const;
  temAcessoGlobal(): boolean {
    return true;
  }
}

/** Conta comum: o que pode em cada campeonato depende do papel que tem nele. */
export class ContaPadrao extends PapelNoSite {
  readonly tipo = 'PADRAO' as const;
  temAcessoGlobal(): boolean {
    return false;
  }
}
