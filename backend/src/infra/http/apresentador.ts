import { Inject, Injectable } from '@nestjs/common';
import { CampeonatoVisto } from '../../application/casos-de-uso/base';
import {
  Acao,
  Ator,
  Campeonato,
  ConvitePorEmail,
  ConvitePorLink,
  Equipe,
  Fase,
  Id,
  Partida,
  USUARIO_REPOSITORY,
  UsuarioRepository,
} from '../../domain';

type Nomes = Map<Id, string>;

/**
 * Presenter: transforma o agregado em JSON para o frontend.
 * Recebe o papel de quem pediu e esconde o que essa pessoa não pode ver
 * (documentos, inscrições alheias, convites, chave de acesso, banimentos).
 */
@Injectable()
export class CampeonatoApresentador {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository) {}

  resumo({ campeonato: c, papel }: CampeonatoVisto) {
    const partidas = c.todasAsPartidas();
    return {
      id: c.id,
      nome: c.nome,
      modalidade: c.modalidade,
      descricao: c.descricao,
      status: c.status,
      formato: c.regulamento.formato,
      visibilidade: c.visibilidade.tipo,
      modoInscricao: c.modoInscricao.tipo,
      criadorId: c.criadorId,
      meuPapel: papel.tipo,
      quantidadeDeEquipes: c.equipesAprovadas.length,
      partidasJogadas: partidas.filter((p) => p.finalizada).length,
      partidasTotais: partidas.length,
      faseAtual: c.faseAtual?.nome ?? null,
      campeao: c.campeaoId ? CampeonatoApresentador.equipe(c, c.campeaoId) : null,
      criadoEm: c.criadoEm.toISOString(),
    };
  }

  async detalhe(visto: CampeonatoVisto, ator: Ator) {
    const { campeonato: c, papel } = visto;
    const organiza = papel.fazParteDaOrganizacao;
    const nomes = await this.nomesDe(c, organiza);
    const meuId = ator.usuarioId;
    const minha = meuId ? c.equipeDoResponsavel(meuId) : undefined;

    // organizadores veem todas as equipes; os demais, só as aprovadas e a própria
    const visiveis = c.equipes.filter((e) => organiza || e.aprovada || e === minha);

    return {
      ...this.resumo(visto),
      meuPapelDescricao: papel.descricao,
      permissoes: papel.acoes(),
      podeInscreverTime:
        papel.pode(Acao.INSCREVER_PROPRIO_TIME) &&
        c.status === 'INSCRICOES_ABERTAS' &&
        c.modoInscricao.aceitaInscricaoDeEspectador() &&
        !organiza,
      avisos: organiza ? c.avisosDeConfiguracao() : [],
      regulamento: c.regulamento.snapshot(),
      faseAtualId: c.faseAtual?.id ?? null,
      criador: { id: c.criadorId, nome: nomes.get(c.criadorId) ?? 'Criador' },
      organizadores: c.organizadores.map((id) => ({ id, nome: nomes.get(id) ?? '?' })),
      minhaEquipeId: minha?.id ?? null,
      meuBanimento: meuId && c.banimentoDe(meuId) ? { nivel: c.banimentoDe(meuId)!.nivel, motivo: c.banimentoDe(meuId)!.motivo } : null,
      equipes: visiveis.map((e) => CampeonatoApresentador.equipeCompleta(e, nomes, organiza || e === minha)),
      chaveDeAcesso: organiza ? c.chaveDeAcesso.valor : null,
      convites: papel.pode(Acao.GERENCIAR_ORGANIZADORES) ? CampeonatoApresentador.convites(c, nomes) : [],
      banimentos: papel.pode(Acao.BANIR)
        ? c.banimentos.map((b) => ({ usuario: { id: b.usuarioId, nome: nomes.get(b.usuarioId) ?? '?' }, nivel: b.nivel, motivo: b.motivo }))
        : [],
      fases: c.fases.map((f) => CampeonatoApresentador.fase(c, f)),
      tabelas: CampeonatoApresentador.tabelas(c),
      artilharia: c.artilharia(),
      suspensoes: CampeonatoApresentador.suspensoes(c),
    };
  }

  static tabelas(c: Campeonato) {
    return c.tabelas().map((t) => ({ ...t, linhas: t.linhas.map((l) => l.toJSON()) }));
  }

  static suspensoes(c: Campeonato) {
    return c.suspensoes.map((s) => {
      const equipe = c.obterEquipe(s.equipeId);
      const jogador = equipe.buscarJogador(s.jogadorId);
      return {
        id: s.id,
        jogador: { id: s.jogadorId, nome: jogador?.nome ?? '?', numero: jogador?.numero ?? 0 },
        equipe: { id: equipe.id, nome: equipe.nome },
        motivo: s.motivo,
        jogos: s.jogos,
        jogosRestantes: s.jogosRestantes,
        ativa: s.ativa,
        partidaOrigemId: s.partidaOrigemId,
      };
    });
  }

  /** Nomes das contas que aparecem na resposta (criador, organizadores, responsáveis, banidos). */
  private async nomesDe(c: Campeonato, organiza: boolean): Promise<Nomes> {
    const ids = new Set<Id>([c.criadorId, ...c.organizadores]);
    if (organiza) {
      for (const e of c.equipes) if (e.responsavelId) ids.add(e.responsavelId);
      for (const b of c.banimentos) ids.add(b.usuarioId);
    }
    const usuarios = await this.usuarios.buscarVarios([...ids]);
    return new Map(usuarios.map((u) => [u.id, u.nome]));
  }

  private static equipeCompleta(e: Equipe, nomes: Nomes, comDetalhes: boolean) {
    return {
      id: e.id,
      nome: e.nome,
      status: e.status,
      motivoRecusa: comDetalhes ? e.motivoRecusa : null,
      responsavel: e.responsavelId && comDetalhes ? { id: e.responsavelId, nome: nomes.get(e.responsavelId) ?? 'Você' } : null,
      // o documento é dado pessoal: só organizadores e o responsável pelo time veem
      jogadores: e.jogadores.map((j) => ({ ...j.snapshot(), documento: comDetalhes ? j.documento : null })),
    };
  }

  private static convites(c: Campeonato, nomes: Nomes) {
    return c.convitesAtivos.map((cv) => ({
      id: cv.id,
      tipo: cv.tipo,
      email: cv instanceof ConvitePorEmail ? cv.email : null,
      token: cv instanceof ConvitePorLink ? cv.token : null,
      criadoPor: { id: cv.criadoPor, nome: nomes.get(cv.criadoPor) ?? '?' },
    }));
  }

  private static fase(c: Campeonato, f: Fase) {
    return {
      id: f.id,
      nome: f.nome,
      tipo: f.tipo,
      ordem: f.ordem,
      completa: f.completa(),
      grupos: f.grupos.map((g) => ({ nome: g.nome, equipeIds: [...g.equipeIds] })),
      partidas: [...f.partidas]
        .sort((a, b) => a.rodada - b.rodada || (a.grupo ?? '').localeCompare(b.grupo ?? '') || a.posicao - b.posicao)
        .map((p) => CampeonatoApresentador.partida(c, f, p)),
    };
  }

  static partida(c: Campeonato, f: Fase, p: Partida) {
    const jogadores = new Map(c.equipes.flatMap((e) => e.jogadores.map((j) => [j.id, j] as const)));
    const suspensos = p.finalizada
      ? []
      : [p.mandanteId, p.visitanteId].flatMap((eid) =>
          c.obterEquipe(eid).jogadores.filter((j) => c.estaSuspenso(j.id, p.id)).map((j) => j.id),
        );
    return {
      id: p.id,
      faseId: f.id,
      fase: f.nome,
      rodada: p.rodada,
      grupo: p.grupo,
      posicao: p.posicao,
      eliminatoria: p.eliminatoria,
      status: p.status,
      mandante: CampeonatoApresentador.equipe(c, p.mandanteId),
      visitante: CampeonatoApresentador.equipe(c, p.visitanteId),
      placar: p.placar(),
      penaltis: p.penaltis,
      vencedorId: p.vencedorId(),
      suspensos,
      eventos: p.eventos.map((e) => {
        const j = jogadores.get(e.jogadorId);
        return {
          id: e.id,
          tipo: e.tipo,
          minuto: e.minuto,
          equipeId: e.equipeId,
          segundoAmarelo: e.snapshot().segundoAmarelo,
          jogador: { id: e.jogadorId, nome: j?.nome ?? '?', numero: j?.numero ?? 0 },
        };
      }),
    };
  }

  private static equipe(c: Campeonato, id: Id) {
    const e = c.equipes.find((x) => x.id === id);
    return { id, nome: e?.nome ?? '?' };
  }
}
