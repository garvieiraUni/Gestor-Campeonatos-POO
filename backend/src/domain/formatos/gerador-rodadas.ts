import { Id } from '../compartilhado/id';

export interface Confronto {
  rodada: number;
  mandanteId: Id;
  visitanteId: Id;
}

/**
 * Gera "todos contra todos" pelo método do círculo (R5).
 * Com número ímpar de equipes, uma equipe folga por rodada (R6).
 */
export class GeradorDeRodadas {
  static todosContraTodos(equipeIds: readonly Id[], idaEVolta = false): Confronto[] {
    const lista: (Id | null)[] = [...equipeIds];
    if (lista.length < 2) return [];
    if (lista.length % 2 === 1) lista.push(null); // null = folga

    const n = lista.length;
    const rodadas = n - 1;
    const confrontos: Confronto[] = [];
    const rot = [...lista];

    for (let r = 0; r < rodadas; r++) {
      for (let i = 0; i < n / 2; i++) {
        const a = rot[i];
        const b = rot[n - 1 - i];
        if (a === null || b === null) continue;
        // alterna o mando para ninguém jogar sempre em casa
        const inverter = i === 0 ? r % 2 === 1 : i % 2 === 1;
        confrontos.push({ rodada: r + 1, mandanteId: inverter ? b : a, visitanteId: inverter ? a : b });
      }
      // fixa o primeiro e gira os demais
      rot.splice(1, 0, rot.pop()!);
    }

    if (idaEVolta) {
      const volta = confrontos.map((c) => ({
        rodada: c.rodada + rodadas,
        mandanteId: c.visitanteId,
        visitanteId: c.mandanteId,
      }));
      confrontos.push(...volta);
    }
    return confrontos;
  }
}
