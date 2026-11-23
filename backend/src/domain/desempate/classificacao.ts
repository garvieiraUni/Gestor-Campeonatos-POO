import { Id } from '../compartilhado/id';
import { Partida } from '../entidades/partida';
import { RegraPontuacao } from '../pontuacao/regra-pontuacao';
import { CriterioDesempate } from './criterios';
import { LinhaTabela } from './linha-tabela';

/**
 * Calcula a tabela a partir das partidas finalizadas.
 * Nada é gravado no banco: a tabela é sempre derivada, então nunca fica inconsistente.
 */
export class Classificacao {
  constructor(
    private readonly pontuacao: RegraPontuacao,
    private readonly desempate: CriterioDesempate,
  ) {}

  calcular(equipes: readonly { id: Id; nome: string }[], partidas: readonly Partida[]): LinhaTabela[] {
    const linhas = new Map(equipes.map((e) => [e.id, new LinhaTabela(e.id, e.nome)]));
    const relevantes = partidas.filter(
      (p) => p.finalizada && linhas.has(p.mandanteId) && linhas.has(p.visitanteId),
    );

    for (const p of relevantes) {
      const placar = p.placar();
      const est = p.estatisticas();
      const mandante = linhas.get(p.mandanteId)!;
      const visitante = linhas.get(p.visitanteId)!;
      const rm = p.resultadoPara(p.mandanteId);
      const rv = p.resultadoPara(p.visitanteId);
      mandante.registrarJogo(rm, placar.mandante, placar.visitante, this.pontuacao.pontosPor(rm));
      visitante.registrarJogo(rv, placar.visitante, placar.mandante, this.pontuacao.pontosPor(rv));
      mandante.pontosFairPlay += est.fairPlayDe(p.mandanteId);
      visitante.pontosFairPlay += est.fairPlayDe(p.visitanteId);
    }

    const ctx = { partidas: relevantes, pontuacao: this.pontuacao };
    const ordenadas = [...linhas.values()].sort((a, b) => this.desempate.comparar(a, b, ctx));
    ordenadas.forEach((l, i) => (l.posicao = i + 1));
    return ordenadas;
  }
}
