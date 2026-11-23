import { Campeonato, Fase, Id, Partida } from '../../domain';

/**
 * Presenter: transforma o agregado em JSON para o frontend.
 * Mantém o domínio livre de preocupações com formato de resposta.
 */
export class CampeonatoApresentador {
  static resumo(c: Campeonato) {
    const partidas = c.todasAsPartidas();
    return {
      id: c.id,
      nome: c.nome,
      modalidade: c.modalidade,
      descricao: c.descricao,
      status: c.status,
      formato: c.regulamento.formato,
      organizadorId: c.organizadorId,
      quantidadeDeEquipes: c.equipes.length,
      partidasJogadas: partidas.filter((p) => p.finalizada).length,
      partidasTotais: partidas.length,
      faseAtual: c.faseAtual?.nome ?? null,
      campeao: c.campeaoId ? CampeonatoApresentador.equipe(c, c.campeaoId) : null,
      criadoEm: c.criadoEm.toISOString(),
    };
  }

  static detalhe(c: Campeonato) {
    return {
      ...CampeonatoApresentador.resumo(c),
      regulamento: c.regulamento.snapshot(),
      faseAtualId: c.faseAtual?.id ?? null,
      equipes: c.equipes.map((e) => ({
        id: e.id,
        nome: e.nome,
        jogadores: e.jogadores.map((j) => j.snapshot()),
      })),
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
