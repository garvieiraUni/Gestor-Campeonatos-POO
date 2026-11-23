import { RegraDeNegocioError } from '../compartilhado/erros';
import { Partida } from '../entidades/partida';
import { RegraPontuacao } from '../pontuacao/regra-pontuacao';
import { LinhaTabela } from './linha-tabela';

export type TipoCriterio = 'PONTOS' | 'VITORIAS' | 'SALDO_DE_GOLS' | 'GOLS_PRO' | 'CONFRONTO_DIRETO' | 'FAIR_PLAY';

export const TIPOS_CRITERIO: readonly TipoCriterio[] = [
  'PONTOS',
  'VITORIAS',
  'SALDO_DE_GOLS',
  'GOLS_PRO',
  'CONFRONTO_DIRETO',
  'FAIR_PLAY',
];

export interface ContextoDesempate {
  partidas: readonly Partida[];
  pontuacao: RegraPontuacao;
}

/**
 * Chain of Responsibility + Template Method.
 * Cada critério tenta separar as duas equipes; se empatar, passa para o próximo da corrente.
 * Retorno negativo = "a" fica na frente de "b".
 */
export abstract class CriterioDesempate {
  abstract readonly tipo: TipoCriterio | 'ORDEM_ALFABETICA';
  private proximo: CriterioDesempate | null = null;

  /** Liga o próximo elo e devolve ele, para permitir encadear: a.encadear(b).encadear(c). */
  encadear(proximo: CriterioDesempate): CriterioDesempate {
    this.proximo = proximo;
    return proximo;
  }

  comparar(a: LinhaTabela, b: LinhaTabela, ctx: ContextoDesempate): number {
    const r = this.avaliar(a, b, ctx);
    if (r !== 0) return r;
    return this.proximo ? this.proximo.comparar(a, b, ctx) : 0;
  }

  protected abstract avaliar(a: LinhaTabela, b: LinhaTabela, ctx: ContextoDesempate): number;
}

export class CriterioPontos extends CriterioDesempate {
  readonly tipo = 'PONTOS' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return b.pontos - a.pontos;
  }
}

export class CriterioVitorias extends CriterioDesempate {
  readonly tipo = 'VITORIAS' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return b.vitorias - a.vitorias;
  }
}

export class CriterioSaldoDeGols extends CriterioDesempate {
  readonly tipo = 'SALDO_DE_GOLS' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return b.saldo - a.saldo;
  }
}

export class CriterioGolsPro extends CriterioDesempate {
  readonly tipo = 'GOLS_PRO' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return b.golsPro - a.golsPro;
  }
}

/** Pontos conquistados apenas nos jogos entre as duas equipes. */
export class CriterioConfrontoDireto extends CriterioDesempate {
  readonly tipo = 'CONFRONTO_DIRETO' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela, ctx: ContextoDesempate): number {
    let pontosA = 0;
    let pontosB = 0;
    for (const p of ctx.partidas) {
      if (!p.finalizada || !p.envolve(a.equipeId) || !p.envolve(b.equipeId)) continue;
      pontosA += ctx.pontuacao.pontosPor(p.resultadoPara(a.equipeId));
      pontosB += ctx.pontuacao.pontosPor(p.resultadoPara(b.equipeId));
    }
    return pontosB - pontosA;
  }
}

/** R8: menos pontos de cartão fica à frente. */
export class CriterioFairPlay extends CriterioDesempate {
  readonly tipo = 'FAIR_PLAY' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return a.pontosFairPlay - b.pontosFairPlay;
  }
}

/** Último elo, sempre presente: garante uma ordem estável e reproduzível nos testes. */
export class CriterioOrdemAlfabetica extends CriterioDesempate {
  readonly tipo = 'ORDEM_ALFABETICA' as const;
  protected avaliar(a: LinhaTabela, b: LinhaTabela): number {
    return a.nome.localeCompare(b.nome, 'pt-BR');
  }
}

/** Factory que monta a corrente na ordem definida pelo regulamento. */
export class CadeiaDeDesempateFactory {
  static criar(tipos: readonly TipoCriterio[]): CriterioDesempate {
    const elos = tipos.map(CadeiaDeDesempateFactory.criarCriterio);
    elos.push(new CriterioOrdemAlfabetica());
    for (let i = 0; i < elos.length - 1; i++) elos[i].encadear(elos[i + 1]);
    return elos[0];
  }

  static criarCriterio(tipo: TipoCriterio): CriterioDesempate {
    switch (tipo) {
      case 'PONTOS':
        return new CriterioPontos();
      case 'VITORIAS':
        return new CriterioVitorias();
      case 'SALDO_DE_GOLS':
        return new CriterioSaldoDeGols();
      case 'GOLS_PRO':
        return new CriterioGolsPro();
      case 'CONFRONTO_DIRETO':
        return new CriterioConfrontoDireto();
      case 'FAIR_PLAY':
        return new CriterioFairPlay();
      default:
        throw new RegraDeNegocioError(`Critério de desempate desconhecido: ${String(tipo)}`);
    }
  }
}
