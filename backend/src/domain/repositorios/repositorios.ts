import { Id } from '../compartilhado/id';
import { Campeonato } from '../entidades/campeonato';
import { Usuario } from '../entidades/usuario';

/**
 * Interfaces de repositório (inversão de dependência).
 * O domínio define O QUE precisa; a infraestrutura decide COMO (memória ou PostgreSQL).
 */
export interface CampeonatoRepository {
  /**
   * Grava o agregado inteiro. Lança ConflitoDeVersaoError se outra pessoa salvou antes
   * (lock otimista) e, em caso de sucesso, avança a versão do campeonato.
   */
  salvar(campeonato: Campeonato): Promise<void>;
  buscarPorId(id: Id): Promise<Campeonato | null>;
  listar(): Promise<Campeonato[]>;
  excluir(id: Id): Promise<void>;
  buscarPorTokenDeConvite(token: string): Promise<Campeonato | null>;
  /** Campeonatos com convite por e-mail pendente para este endereço. */
  listarComConvitePara(email: string): Promise<Campeonato[]>;
}

export interface UsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: Id): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarVarios(ids: readonly Id[]): Promise<Usuario[]>;
}

export const CAMPEONATO_REPOSITORY = Symbol('CampeonatoRepository');
export const USUARIO_REPOSITORY = Symbol('UsuarioRepository');
