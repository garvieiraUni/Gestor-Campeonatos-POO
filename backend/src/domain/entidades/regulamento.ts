import { garantir } from '../compartilhado/erros';
import { CadeiaDeDesempateFactory, TIPOS_CRITERIO, TipoCriterio } from '../desempate/criterios';
import { Classificacao } from '../desempate/classificacao';
import { PontuacaoPorResultado } from '../pontuacao/regra-pontuacao';

export type TipoFormato = 'PONTOS_CORRIDOS' | 'MATA_MATA' | 'GRUPOS_E_MATA_MATA';
export const TIPOS_FORMATO: readonly TipoFormato[] = ['PONTOS_CORRIDOS', 'MATA_MATA', 'GRUPOS_E_MATA_MATA'];

export interface RegulamentoProps {
  formato: TipoFormato;
  minJogadores: number;
  maxJogadores: number;
  pontosVitoria: number;
  pontosEmpate: number;
  pontosDerrota: number;
  criteriosDesempate: TipoCriterio[];
  /** Pontos corridos e grupos: turno e returno. */
  idaEVolta: boolean;
  /** Só para GRUPOS_E_MATA_MATA. */
  numeroGrupos: number;
  /** R9: quantos amarelos acumulados geram suspensão. */
  amarelosParaSuspensao: number;
  /** R10: quantos jogos de gancho um vermelho gera. */
  jogosSuspensaoVermelho: number;
}

export const REGULAMENTO_PADRAO: RegulamentoProps = {
  formato: 'PONTOS_CORRIDOS',
  minJogadores: 5,
  maxJogadores: 20,
  pontosVitoria: 3,
  pontosEmpate: 1,
  pontosDerrota: 0,
  criteriosDesempate: ['PONTOS', 'VITORIAS', 'SALDO_DE_GOLS', 'GOLS_PRO', 'CONFRONTO_DIRETO', 'FAIR_PLAY'],
  idaEVolta: false,
  numeroGrupos: 2,
  amarelosParaSuspensao: 2,
  jogosSuspensaoVermelho: 1,
};

/** Value Object imutável com as regras do campeonato. Validado na criação. */
export class Regulamento {
  private constructor(readonly props: Readonly<RegulamentoProps>) {}

  static criar(parcial: Partial<RegulamentoProps> = {}): Regulamento {
    const p: RegulamentoProps = { ...REGULAMENTO_PADRAO, ...parcial };
    p.criteriosDesempate = [...(parcial.criteriosDesempate ?? REGULAMENTO_PADRAO.criteriosDesempate)];

    garantir(
      (TIPOS_FORMATO as readonly string[]).includes(p.formato),
      `Formato inválido: ${String(p.formato)}`,
    );
    garantir(Number.isInteger(p.minJogadores) && p.minJogadores >= 1, 'O mínimo de jogadores deve ser pelo menos 1');
    garantir(
      Number.isInteger(p.maxJogadores) && p.maxJogadores >= p.minJogadores && p.maxJogadores <= 50,
      'O máximo de jogadores deve ser maior ou igual ao mínimo (e no máximo 50)',
    );
    garantir(p.criteriosDesempate.length > 0, 'Informe ao menos um critério de desempate');
    garantir(p.criteriosDesempate[0] === 'PONTOS', 'O primeiro critério de classificação deve ser PONTOS');
    garantir(
      p.criteriosDesempate.every((c) => TIPOS_CRITERIO.includes(c)),
      'Há um critério de desempate inválido',
    );
    garantir(
      new Set(p.criteriosDesempate).size === p.criteriosDesempate.length,
      'Critérios de desempate não podem se repetir',
    );
    garantir(
      [2, 4, 8].includes(p.numeroGrupos),
      'O número de grupos deve ser 2, 4 ou 8',
    );
    garantir(
      Number.isInteger(p.amarelosParaSuspensao) && p.amarelosParaSuspensao >= 2,
      'São necessários pelo menos 2 amarelos para suspensão',
    );
    garantir(
      Number.isInteger(p.jogosSuspensaoVermelho) && p.jogosSuspensaoVermelho >= 1,
      'O vermelho deve suspender por pelo menos 1 jogo',
    );
    // valida a pontuação construindo a regra (lança erro se for inválida)
    new PontuacaoPorResultado(p.pontosVitoria, p.pontosEmpate, p.pontosDerrota);

    return new Regulamento(Object.freeze(p));
  }

  get formato(): TipoFormato {
    return this.props.formato;
  }

  criarClassificacao(): Classificacao {
    const pontuacao = new PontuacaoPorResultado(this.props.pontosVitoria, this.props.pontosEmpate, this.props.pontosDerrota);
    return new Classificacao(pontuacao, CadeiaDeDesempateFactory.criar(this.props.criteriosDesempate));
  }

  snapshot(): RegulamentoProps {
    return { ...this.props, criteriosDesempate: [...this.props.criteriosDesempate] };
  }
}
