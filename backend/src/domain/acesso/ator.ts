import { Id } from '../compartilhado/id';
import type { Usuario } from '../entidades/usuario';
import { PapelNoSite } from './papel-no-site';

/**
 * Value Object: quem está fazendo a requisição.
 * Pode ser um visitante anônimo ou uma conta logada (com o seu papel no site).
 */
export class Ator {
  private constructor(
    readonly usuarioId: Id | null,
    readonly nome: string | null,
    readonly email: string | null,
    readonly papelNoSite: PapelNoSite | null,
  ) {}

  static visitante(): Ator {
    return new Ator(null, null, null, null);
  }

  static deUsuario(u: Usuario): Ator {
    return new Ator(u.id, u.nome, u.email, u.papel);
  }

  get logado(): boolean {
    return this.usuarioId !== null;
  }

  get temAcessoGlobal(): boolean {
    return this.papelNoSite?.temAcessoGlobal() ?? false;
  }

  /** Para casos de uso que só fazem sentido com login (o guard já garante isso na HTTP). */
  get conta(): { id: Id; nome: string; email: string } {
    if (!this.usuarioId) throw new Error('Ação exige uma conta logada');
    return { id: this.usuarioId, nome: this.nome!, email: this.email! };
  }
}
