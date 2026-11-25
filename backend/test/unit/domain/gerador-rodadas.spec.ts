import { GeradorDeRodadas } from '../../../src/domain';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const chave = (a: string, b: string) => [a, b].sort().join('x');

describe('GeradorDeRodadas — todos contra todos (R5, R6)', () => {
  it('8 equipes geram 7 rodadas com 4 jogos cada, sem confronto repetido', () => {
    const confrontos = GeradorDeRodadas.todosContraTodos(ids(8));

    expect(confrontos).toHaveLength(28);
    expect(new Set(confrontos.map((c) => c.rodada)).size).toBe(7);
    expect(new Set(confrontos.map((c) => chave(c.mandanteId, c.visitanteId))).size).toBe(28);
    for (let r = 1; r <= 7; r++) {
      const daRodada = confrontos.filter((c) => c.rodada === r);
      expect(daRodada).toHaveLength(4);
      const equipes = daRodada.flatMap((c) => [c.mandanteId, c.visitanteId]);
      expect(new Set(equipes).size).toBe(8); // ninguém joga duas vezes na mesma rodada
    }
  });

  it('número ímpar: cada equipe folga exatamente uma vez (R6)', () => {
    const equipes = ids(5);
    const confrontos = GeradorDeRodadas.todosContraTodos(equipes);

    expect(confrontos).toHaveLength(10);
    const rodadas = new Set(confrontos.map((c) => c.rodada));
    expect(rodadas.size).toBe(5);
    for (const e of equipes) {
      const rodadasJogadas = new Set(confrontos.filter((c) => c.mandanteId === e || c.visitanteId === e).map((c) => c.rodada));
      expect(rodadasJogadas.size).toBe(4); // folga em 1 das 5
    }
  });

  it('ida e volta repete os confrontos com o mando invertido', () => {
    const confrontos = GeradorDeRodadas.todosContraTodos(ids(4), true);
    expect(confrontos).toHaveLength(12);
    const ida = confrontos.filter((c) => c.rodada <= 3);
    const volta = confrontos.filter((c) => c.rodada > 3);
    for (const c of ida) {
      expect(volta).toContainEqual(expect.objectContaining({ mandanteId: c.visitanteId, visitanteId: c.mandanteId }));
    }
  });

  it('mando de campo fica equilibrado', () => {
    const confrontos = GeradorDeRodadas.todosContraTodos(ids(6));
    for (const e of ids(6)) {
      const emCasa = confrontos.filter((c) => c.mandanteId === e).length;
      expect(emCasa).toBeGreaterThanOrEqual(2);
      expect(emCasa).toBeLessThanOrEqual(3);
    }
  });
});
