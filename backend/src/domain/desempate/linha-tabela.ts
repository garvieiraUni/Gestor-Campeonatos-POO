import { Id } from '../compartilhado/id';
import { Resultado } from '../entidades/partida';

/** Uma linha da tabela de classificação. */
export class LinhaTabela {
  posicao = 0;
  jogos = 0;
  vitorias = 0;
  empates = 0;
  derrotas = 0;
  golsPro = 0;
  golsContra = 0;
  pontos = 0;
  /** Soma de pontos de cartões (menos é melhor). */
  pontosFairPlay = 0;

  constructor(
    readonly equipeId: Id,
    readonly nome: string,
  ) {}

  get saldo(): number {
    return this.golsPro - this.golsContra;
  }

  registrarJogo(resultado: Resultado, golsPro: number, golsContra: number, pontos: number): void {
    this.jogos++;
    this.golsPro += golsPro;
    this.golsContra += golsContra;
    this.pontos += pontos;
    if (resultado === 'VITORIA') this.vitorias++;
    else if (resultado === 'EMPATE') this.empates++;
    else this.derrotas++;
  }

  toJSON() {
    return {
      posicao: this.posicao,
      equipeId: this.equipeId,
      nome: this.nome,
      jogos: this.jogos,
      vitorias: this.vitorias,
      empates: this.empates,
      derrotas: this.derrotas,
      golsPro: this.golsPro,
      golsContra: this.golsContra,
      saldo: this.saldo,
      pontos: this.pontos,
      pontosFairPlay: this.pontosFairPlay,
    };
  }
}
