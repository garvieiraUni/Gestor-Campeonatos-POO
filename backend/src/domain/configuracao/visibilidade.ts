import { timingSafeEqual } from 'node:crypto';
import { RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { novaChave } from '../compartilhado/id';

/** Value Object: o segredo do link de acesso de um campeonato privado. */
export class ChaveDeAcesso {
  private constructor(readonly valor: string) {}

  static gerar(): ChaveDeAcesso {
    return new ChaveDeAcesso(novaChave());
  }

  static de(valor: string): ChaveDeAcesso {
    garantir(valor && valor.length >= 16, 'Chave de acesso inválida');
    return new ChaveDeAcesso(valor);
  }

  /** Comparação em tempo constante, para não dar pistas da chave pelo tempo de resposta. */
  confere(informada: string | null | undefined): boolean {
    if (!informada) return false;
    const a = Buffer.from(this.valor);
    const b = Buffer.from(informada);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export type TipoVisibilidade = 'PUBLICA' | 'PRIVADA';
export const TIPOS_VISIBILIDADE: readonly TipoVisibilidade[] = ['PUBLICA', 'PRIVADA'];

/** O que a visibilidade precisa saber para decidir se alguém (que não organiza) pode ver. */
export interface ContextoDeVisualizacao {
  /** A pessoa já participa (tem um time inscrito, por exemplo). */
  participa: boolean;
  chave: ChaveDeAcesso;
  chaveInformada: string | null | undefined;
}

/** Strategy: quem consegue ver o campeonato e se ele aparece na lista pública. */
export abstract class Visibilidade {
  abstract readonly tipo: TipoVisibilidade;
  abstract permiteVer(ctx: ContextoDeVisualizacao): boolean;
  abstract apareceNaListaPublica(): boolean;

  static de(tipo: TipoVisibilidade): Visibilidade {
    switch (tipo) {
      case 'PUBLICA':
        return new Publica();
      case 'PRIVADA':
        return new Privada();
      default:
        throw new RegraDeNegocioError(`Visibilidade desconhecida: ${String(tipo)}`);
    }
  }
}

/** Qualquer pessoa vê e o campeonato aparece na lista do site. */
export class Publica extends Visibilidade {
  readonly tipo = 'PUBLICA' as const;
  permiteVer(): boolean {
    return true;
  }
  apareceNaListaPublica(): boolean {
    return true;
  }
}

/** Só quem tem o link (a chave) ou já participa. */
export class Privada extends Visibilidade {
  readonly tipo = 'PRIVADA' as const;
  permiteVer(ctx: ContextoDeVisualizacao): boolean {
    return ctx.participa || ctx.chave.confere(ctx.chaveInformada);
  }
  apareceNaListaPublica(): boolean {
    return false;
  }
}
