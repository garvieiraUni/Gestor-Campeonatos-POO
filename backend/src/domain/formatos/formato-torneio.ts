import { Id } from '../compartilhado/id';
import { Classificacao } from '../desempate/classificacao';
import { Fase } from '../entidades/fase';
import { RegulamentoProps, TipoFormato } from '../entidades/regulamento';

export interface EquipeResumo {
  id: Id;
  nome: string;
}

export interface ContextoFormato {
  equipes: readonly EquipeResumo[];
  classificacao: Classificacao;
  regulamento: Readonly<RegulamentoProps>;
}

/**
 * Strategy: cada formato de torneio sabe validar, gerar as fases e apontar o campeão.
 * O Campeonato só conversa com esta interface e não sabe qual formato está usando.
 */
export interface FormatoTorneio {
  readonly tipo: TipoFormato;
  validarInicio(quantidadeDeEquipes: number, regulamento: Readonly<RegulamentoProps>): void;
  gerarFaseInicial(ctx: ContextoFormato): Fase;
  /** A próxima fase, ou null se a fase atual for a última. */
  gerarProximaFase(faseAtual: Fase, ctx: ContextoFormato): Fase | null;
  campeao(faseFinal: Fase, ctx: ContextoFormato): Id;
}
