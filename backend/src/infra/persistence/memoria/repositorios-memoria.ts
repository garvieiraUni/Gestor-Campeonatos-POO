import {
  Campeonato,
  CampeonatoRepository,
  CampeonatoSnapshot,
  Id,
  Usuario,
  UsuarioRepository,
  UsuarioSnapshot,
} from '../../../domain';

/**
 * Implementações em memória das interfaces de repositório.
 * Guardam cópias (snapshots) para se comportar como um banco de verdade:
 * alterar o objeto sem chamar `salvar` não muda o que está guardado.
 * Usadas nos testes e no modo de demonstração (PERSISTENCIA=memoria).
 */
export class CampeonatoRepositoryEmMemoria implements CampeonatoRepository {
  private readonly dados = new Map<Id, CampeonatoSnapshot>();

  async salvar(c: Campeonato): Promise<void> {
    this.dados.set(c.id, structuredClone(c.snapshot()));
  }

  async buscarPorId(id: Id): Promise<Campeonato | null> {
    const s = this.dados.get(id);
    return s ? Campeonato.restaurar(structuredClone(s)) : null;
  }

  async listar(): Promise<Campeonato[]> {
    return [...this.dados.values()].map((s) => Campeonato.restaurar(structuredClone(s)));
  }
}

export class UsuarioRepositoryEmMemoria implements UsuarioRepository {
  private readonly dados = new Map<Id, UsuarioSnapshot>();

  async salvar(u: Usuario): Promise<void> {
    this.dados.set(u.id, u.snapshot());
  }

  async buscarPorId(id: Id): Promise<Usuario | null> {
    const s = this.dados.get(id);
    return s ? Usuario.restaurar(s) : null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const s = [...this.dados.values()].find((u) => u.email === email.toLowerCase());
    return s ? Usuario.restaurar(s) : null;
  }
}
