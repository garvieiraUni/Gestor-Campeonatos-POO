import { garantir } from '../compartilhado/erros';
import { Resultado } from '../entidades/partida';

/** Strategy de pontuação: quantos pontos vale cada resultado. */
export interface RegraPontuacao {
  pontosPor(resultado: Resultado): number;
}

/** R4: pontuação configurável (padrão 3 / 1 / 0). */
export class PontuacaoPorResultado implements RegraPontuacao {
  constructor(
    private readonly vitoria = 3,
    private readonly empate = 1,
    private readonly derrota = 0,
  ) {
    garantir(derrota >= 0, 'Pontos por derrota não podem ser negativos');
    garantir(vitoria > empate && empate >= derrota, 'A pontuação deve seguir vitória > empate ≥ derrota');
  }

  pontosPor(resultado: Resultado): number {
    switch (resultado) {
      case 'VITORIA':
        return this.vitoria;
      case 'EMPATE':
        return this.empate;
      case 'DERROTA':
        return this.derrota;
    }
  }
}
