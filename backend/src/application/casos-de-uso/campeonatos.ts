import { Acao, Campeonato, CampeonatoRepository, Id, Placar, PoliticaDeAcesso, RegulamentoProps, TipoEvento } from '../../domain';
import { TipoModoInscricao, TipoVisibilidade } from '../../domain';
import { CampeonatoVisto, CasoDeUsoNoCampeonato, Contexto, carregar } from './base';

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export class ListarCampeonatos {
  private readonly politica = new PoliticaDeAcesso();

  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(ctx: Contexto): Promise<CampeonatoVisto[]> {
    const todos = await this.campeonatos.listar();
    return todos
      .filter((c) => this.politica.apareceNaListagem(ctx.ator, c))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      .map((c) => ({ campeonato: c, papel: this.politica.papelDe(ctx.ator, c) }));
  }
}

export class ObterCampeonato {
  private readonly politica = new PoliticaDeAcesso();

  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(id: Id, ctx: Contexto): Promise<CampeonatoVisto> {
    const c = await carregar(this.campeonatos, id);
    const papel = this.politica.exigir(ctx.ator, c, Acao.VER, ctx.chave);
    return { campeonato: c, papel };
  }
}

export class CriarCampeonato {
  private readonly politica = new PoliticaDeAcesso();

  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(
    ctx: Contexto,
    dados: {
      nome: string;
      descricao?: string;
      modalidade?: string;
      regulamento?: Partial<RegulamentoProps>;
      visibilidade?: TipoVisibilidade;
      modoInscricao?: TipoModoInscricao;
    },
  ): Promise<CampeonatoVisto> {
    const c = Campeonato.criar({ ...dados, criadorId: ctx.ator.conta.id });
    await this.campeonatos.salvar(c);
    return { campeonato: c, papel: this.politica.papelDe(ctx.ator, c) };
  }
}

// ---------------------------------------------------------------------------
// Equipes (organizadores)
// ---------------------------------------------------------------------------

export class InscreverEquipe extends CasoDeUsoNoCampeonato<{ nome: string }> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, e: { nome: string }): void {
    c.inscreverEquipe(e.nome);
  }
}

export class RemoverEquipe extends CasoDeUsoNoCampeonato<{ equipeId: Id }> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, e: { equipeId: Id }): void {
    c.removerEquipe(e.equipeId);
  }
}

export interface NovoJogador {
  equipeId: Id;
  nome: string;
  numero: number;
  documento: string;
  posicao?: string | null;
}

export class AdicionarJogador extends CasoDeUsoNoCampeonato<NovoJogador> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, { equipeId, ...dados }: NovoJogador): void {
    c.adicionarJogador(equipeId, dados);
  }
}

export class RemoverJogador extends CasoDeUsoNoCampeonato<{ equipeId: Id; jogadorId: Id }> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, e: { equipeId: Id; jogadorId: Id }): void {
    c.removerJogador(e.equipeId, e.jogadorId);
  }
}

export class IniciarCampeonato extends CasoDeUsoNoCampeonato<void> {
  protected readonly acao = Acao.INICIAR;
  protected aplicar(c: Campeonato): void {
    c.iniciar();
  }
}

// ---------------------------------------------------------------------------
// Súmula (organizadores)
// ---------------------------------------------------------------------------

export class IniciarPartida extends CasoDeUsoNoCampeonato<{ partidaId: Id }> {
  protected readonly acao = Acao.PREENCHER_SUMULA;
  protected aplicar(c: Campeonato, e: { partidaId: Id }): void {
    c.iniciarPartida(e.partidaId);
  }
}

export interface NovoEvento {
  partidaId: Id;
  tipo: TipoEvento;
  jogadorId: Id;
  minuto: number;
}

export class RegistrarEvento extends CasoDeUsoNoCampeonato<NovoEvento> {
  protected readonly acao = Acao.PREENCHER_SUMULA;
  protected aplicar(c: Campeonato, { partidaId, ...evento }: NovoEvento): void {
    c.registrarEvento(partidaId, evento);
  }
}

export class RemoverEvento extends CasoDeUsoNoCampeonato<{ partidaId: Id; eventoId: Id }> {
  protected readonly acao = Acao.PREENCHER_SUMULA;
  protected aplicar(c: Campeonato, e: { partidaId: Id; eventoId: Id }): void {
    c.removerEvento(e.partidaId, e.eventoId);
  }
}

export class FinalizarPartida extends CasoDeUsoNoCampeonato<{ partidaId: Id; penaltis?: Placar | null }> {
  protected readonly acao = Acao.PREENCHER_SUMULA;
  protected aplicar(c: Campeonato, e: { partidaId: Id; penaltis?: Placar | null }): void {
    c.finalizarPartida(e.partidaId, e.penaltis);
  }
}
