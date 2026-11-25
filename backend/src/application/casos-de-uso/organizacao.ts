import {
  Acao,
  Ator,
  Campeonato,
  CampeonatoRepository,
  ConvitePorEmail,
  Id,
  NaoEncontradoError,
  PoliticaDeAcesso,
  UsuarioRepository,
} from '../../domain';
import { CampeonatoVisto, CasoDeUsoNoCampeonato, Contexto, carregar } from './base';

// ---------------------------------------------------------------------------
// Criador: convida e remove organizadores (R22, R23)
// ---------------------------------------------------------------------------

export class ConvidarPorEmail extends CasoDeUsoNoCampeonato<{ email: string }> {
  protected readonly acao = Acao.GERENCIAR_ORGANIZADORES;

  constructor(
    campeonatos: CampeonatoRepository,
    private readonly usuarios: UsuarioRepository,
  ) {
    super(campeonatos);
  }

  protected async aplicar(c: Campeonato, e: { email: string }, ator: Ator): Promise<void> {
    const convidado = await this.usuarios.buscarPorEmail(e.email.trim().toLowerCase());
    if (!convidado) throw new NaoEncontradoError('Não há conta cadastrada com esse e-mail');
    c.convidarPorEmail({ id: convidado.id, email: convidado.email }, ator.conta.id);
  }
}

export class GerarLinkDeConvite extends CasoDeUsoNoCampeonato<void> {
  protected readonly acao = Acao.GERENCIAR_ORGANIZADORES;
  protected aplicar(c: Campeonato, _e: void, ator: Ator): void {
    c.gerarLinkDeConvite(ator.conta.id);
  }
}

export class RevogarConvite extends CasoDeUsoNoCampeonato<{ conviteId: Id }> {
  protected readonly acao = Acao.GERENCIAR_ORGANIZADORES;
  protected aplicar(c: Campeonato, e: { conviteId: Id }): void {
    c.revogarConvite(e.conviteId);
  }
}

export class RemoverOrganizador extends CasoDeUsoNoCampeonato<{ usuarioId: Id }> {
  protected readonly acao = Acao.GERENCIAR_ORGANIZADORES;
  protected aplicar(c: Campeonato, e: { usuarioId: Id }): void {
    c.removerOrganizador(e.usuarioId);
  }
}

/** Qualquer organizador convidado pode deixar a organização. */
export class SairDaOrganizacao extends CasoDeUsoNoCampeonato<void> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, _e: void, ator: Ator): void {
    c.sairDaOrganizacao(ator.conta.id);
  }
}

// ---------------------------------------------------------------------------
// Convidado: responde ao convite.
// Não usam o Template Method porque quem é convidado ainda não tem papel no
// campeonato (que pode até ser privado): quem valida é o próprio Convite.
// ---------------------------------------------------------------------------

abstract class RespostaAoConvite {
  protected readonly politica = new PoliticaDeAcesso();

  constructor(protected readonly campeonatos: CampeonatoRepository) {}

  protected async concluir(c: Campeonato, ctx: Contexto): Promise<CampeonatoVisto> {
    await this.campeonatos.salvar(c);
    return { campeonato: c, papel: this.politica.papelDe(ctx.ator, c, ctx.chave) };
  }
}

export class AceitarConvitePorEmail extends RespostaAoConvite {
  async executar(campeonatoId: Id, conviteId: Id, ctx: Contexto): Promise<CampeonatoVisto> {
    const c = await carregar(this.campeonatos, campeonatoId);
    c.aceitarConvite(c.obterConvite(conviteId), ctx.ator.conta);
    return this.concluir(c, ctx);
  }
}

export class RecusarConvitePorEmail extends RespostaAoConvite {
  async executar(campeonatoId: Id, conviteId: Id, ctx: Contexto): Promise<void> {
    const c = await carregar(this.campeonatos, campeonatoId);
    c.recusarConvite(conviteId, ctx.ator.conta);
    await this.campeonatos.salvar(c);
  }
}

export class AceitarConvitePorLink extends RespostaAoConvite {
  async executar(token: string, ctx: Contexto): Promise<CampeonatoVisto> {
    const c = await this.campeonatos.buscarPorTokenDeConvite(token);
    const convite = c?.conviteComToken(token);
    if (!c || !convite) throw new NaoEncontradoError('Convite não encontrado');
    c.aceitarConvite(convite, ctx.ator.conta);
    return this.concluir(c, ctx);
  }
}

export interface ResumoDoConvite {
  conviteId: Id | null;
  campeonatoId: Id;
  campeonato: string;
  criadorId: Id;
  ativo: boolean;
  jaOrganiza: boolean;
}

/** Prévia do convite por link: mostra o nome do campeonato antes de aceitar. */
export class VerConvitePorLink {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(token: string, ctx: Contexto): Promise<ResumoDoConvite> {
    const c = await this.campeonatos.buscarPorTokenDeConvite(token);
    const convite = c?.conviteComToken(token);
    if (!c || !convite) throw new NaoEncontradoError('Convite não encontrado');
    return {
      conviteId: null,
      campeonatoId: c.id,
      campeonato: c.nome,
      criadorId: c.criadorId,
      ativo: convite.ativo,
      jaOrganiza: c.fazParteDaOrganizacao(ctx.ator.conta.id),
    };
  }
}

/** "Meus convites": convites por e-mail pendentes para a conta logada. */
export class ListarMeusConvites {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(ctx: Contexto): Promise<ResumoDoConvite[]> {
    const { id, email } = ctx.ator.conta;
    const campeonatos = await this.campeonatos.listarComConvitePara(email);
    return campeonatos.flatMap((c) =>
      c.convitesAtivos
        .filter((cv): cv is ConvitePorEmail => cv instanceof ConvitePorEmail && cv.ehPara(email))
        .map((cv) => ({
          conviteId: cv.id,
          campeonatoId: c.id,
          campeonato: c.nome,
          criadorId: c.criadorId,
          ativo: true,
          jaOrganiza: c.fazParteDaOrganizacao(id),
        })),
    );
  }
}
