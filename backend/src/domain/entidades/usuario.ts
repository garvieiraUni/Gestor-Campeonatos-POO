import { PapelNoSite, TipoPapelNoSite } from '../acesso/papel-no-site';
import { garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';

export interface UsuarioSnapshot {
  id: Id;
  nome: string;
  email: string;
  senhaHash: string;
  papel: TipoPapelNoSite;
  criadoEm: string;
}

/**
 * Uma conta do site. O que ela pode fazer em cada campeonato depende do papel que tem nele;
 * o papel no site (ADM ou padrão) só diz se ela tem acesso global.
 */
export class Usuario {
  private papelNoSite: PapelNoSite;

  private constructor(private readonly s: UsuarioSnapshot) {
    this.papelNoSite = PapelNoSite.de(s.papel);
  }

  /** Toda conta nasce padrão: ninguém vira ADM pelo cadastro. */
  static criar(nome: string, email: string, senhaHash: string): Usuario {
    const n = nome?.trim();
    const e = email?.trim().toLowerCase();
    garantir(n && n.length >= 2, 'O nome precisa ter pelo menos 2 caracteres');
    garantir(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 'E-mail inválido');
    return new Usuario({ id: novoId(), nome: n, email: e, senhaHash, papel: 'PADRAO', criadoEm: new Date().toISOString() });
  }

  static restaurar(s: UsuarioSnapshot): Usuario {
    return new Usuario({ ...s, papel: s.papel ?? 'PADRAO' });
  }

  get id(): Id {
    return this.s.id;
  }
  get nome(): string {
    return this.s.nome;
  }
  get email(): string {
    return this.s.email;
  }
  get senhaHash(): string {
    return this.s.senhaHash;
  }
  get papel(): PapelNoSite {
    return this.papelNoSite;
  }

  /** Usado só pelo seed e pelo script `adm:promover`. */
  promoverAAdministrador(): void {
    this.s.papel = 'ADM';
    this.papelNoSite = PapelNoSite.de('ADM');
  }

  snapshot(): UsuarioSnapshot {
    return { ...this.s };
  }
}
