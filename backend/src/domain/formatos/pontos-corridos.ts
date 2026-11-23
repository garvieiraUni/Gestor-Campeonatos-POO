import { garantir } from '../compartilhado/erros';
import { Id } from '../compartilhado/id';
import { Fase } from '../entidades/fase';
import { Partida } from '../entidades/partida';
import { RegulamentoProps } from '../entidades/regulamento';
import { ContextoFormato, FormatoTorneio } from './formato-torneio';
import { GeradorDeRodadas } from './gerador-rodadas';

/** Todos contra todos em uma única fase; campeão = 1º da tabela. */
export class PontosCorridos implements FormatoTorneio {
  readonly tipo = 'PONTOS_CORRIDOS' as const;

  validarInicio(quantidade: number): void {
    garantir(quantidade >= 2, 'Pontos corridos precisa de pelo menos 2 equipes');
  }

  gerarFaseInicial(ctx: ContextoFormato): Fase {
    const ids = ctx.equipes.map((e) => e.id);
    return Fase.criar({
      nome: 'Pontos corridos',
      tipo: 'PONTOS_CORRIDOS',
      ordem: 1,
      grupos: [{ nome: 'Geral', equipeIds: ids }],
      partidas: PontosCorridos.partidasDoGrupo(ids, 'Geral', ctx.regulamento),
    });
  }

  gerarProximaFase(): Fase | null {
    return null;
  }

  campeao(faseFinal: Fase, ctx: ContextoFormato): Id {
    return ctx.classificacao.calcular(ctx.equipes, faseFinal.partidas)[0].equipeId;
  }

  /** Reutilizado pela fase de grupos. */
  static partidasDoGrupo(ids: Id[], grupo: string, regulamento: Readonly<RegulamentoProps>): Partida[] {
    return GeradorDeRodadas.todosContraTodos(ids, regulamento.idaEVolta).map((c, i) =>
      Partida.agendar({ ...c, grupo, posicao: i }),
    );
  }
}
