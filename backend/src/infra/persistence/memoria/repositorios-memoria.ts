import {
  Campeonato,
  CampeonatoRepository,
  CampeonatoSnapshot,
  ConflitoDeVersaoError,
  Id,
  Usuario,
  UsuarioRepository,
  UsuarioSnapshot,
} from '../../../domain';

const MENSAGEM_CONFLITO = 'Outra pessoa alterou este campeonato ao mesmo tempo. Recarregue a página e tente de novo.';

/**
 * Implementações em memória das interfaces de repositório.
 * Guardam cópias (snapshots) para se comportar como um banco de verdade:
 * alterar o objeto sem chamar `salvar` não muda o que está guardado.
 * Usadas nos testes e no modo de demonstração (PERSISTENCIA=memoria).
 */
export class CampeonatoRepositoryEmMemoria implements CampeonatoRepository {
  private readonly dados = new Map<Id, CampeonatoSnapshot>();

  async salvar(c: Campeonato): Promise<void> {
    const guardado = this.dados.get(c.id);
    // lock otimista: só grava se ninguém salvou depois que este objeto foi carregado
    if ((guardado?.versao ?? 0) !== c.versao) throw new ConflitoDeVersaoError(MENSAGEM_CONFLITO);
    this.dados.set(c.id, { ...structuredClone(c.snapshot()), versao: c.versao + 1 });
    c.registrarGravacao();
  }

  async buscarPorId(id: Id): Promise<Campeonato | null> {
    const s = this.dados.get(id);
    return s ? Campeonato.restaurar(structuredClone(s)) : null;
  }

  async listar(): Promise<Campeonato[]> {
    return [...this.dados.values()].map((s) => Campeonato.restaurar(structuredClone(s)));
  }

  async excluir(id: Id): Promise<void> {
    this.dados.delete(id);
  }

  async buscarPorTokenDeConvite(token: string): Promise<Campeonato | null> {
    const s = [...this.dados.values()].find((x) => x.convites.some((c) => c.token === token));
    return s ? Campeonato.restaurar(structuredClone(s)) : null;
  }

  async listarComConvitePara(email: string): Promise<Campeonato[]> {
    const e = email.toLowerCase();
    return [...this.dados.values()]
      .filter((x) => x.convites.some((c) => c.tipo === 'EMAIL' && c.status === 'PENDENTE' && c.email === e))
      .map((s) => Campeonato.restaurar(structuredClone(s)));
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

  async buscarVarios(ids: readonly Id[]): Promise<Usuario[]> {
    return ids.flatMap((id) => {
      const s = this.dados.get(id);
      return s ? [Usuario.restaurar(s)] : [];
    });
  }
}
