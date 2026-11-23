import { Id } from '../compartilhado/id';
import { Campeonato } from '../entidades/campeonato';
import { Usuario } from '../entidades/usuario';

/**
 * Interfaces de repositório (inversão de dependência).
 * O domínio define O QUE precisa; a infraestrutura decide COMO (memória ou PostgreSQL).
 */
export interface CampeonatoRepository {
  salvar(campeonato: Campeonato): Promise<void>;
  buscarPorId(id: Id): Promise<Campeonato | null>;
  listar(): Promise<Campeonato[]>;
}

export interface UsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: Id): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
}

export const CAMPEONATO_REPOSITORY = Symbol('CampeonatoRepository');
export const USUARIO_REPOSITORY = Symbol('UsuarioRepository');
