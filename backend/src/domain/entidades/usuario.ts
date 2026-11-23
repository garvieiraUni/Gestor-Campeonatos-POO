import { garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';

export interface UsuarioSnapshot {
  id: Id;
  nome: string;
  email: string;
  senhaHash: string;
  criadoEm: string;
}

/** Organizador: quem cria e administra campeonatos. Visitantes não precisam de conta. */
export class Usuario {
  private constructor(private readonly s: UsuarioSnapshot) {}

  static criar(nome: string, email: string, senhaHash: string): Usuario {
    const n = nome?.trim();
    const e = email?.trim().toLowerCase();
    garantir(n && n.length >= 2, 'O nome precisa ter pelo menos 2 caracteres');
    garantir(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 'E-mail inválido');
    return new Usuario({ id: novoId(), nome: n, email: e, senhaHash, criadoEm: new Date().toISOString() });
  }

  static restaurar(s: UsuarioSnapshot): Usuario {
    return new Usuario({ ...s });
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

  snapshot(): UsuarioSnapshot {
    return { ...this.s };
  }
}
