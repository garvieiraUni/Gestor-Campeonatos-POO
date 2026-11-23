import { garantir } from '../compartilhado/erros';
import { Id } from '../compartilhado/id';
import { Fase, Grupo } from '../entidades/fase';
import { Partida } from '../entidades/partida';
import { RegulamentoProps } from '../entidades/regulamento';
import { ContextoFormato, FormatoTorneio } from './formato-torneio';
import { MataMata } from './mata-mata';
import { PontosCorridos } from './pontos-corridos';

const LETRAS = 'ABCDEFGH';

/**
 * Grupos em pontos corridos; os 2 primeiros de cada grupo vão ao mata-mata.
 * Reaproveita o MataMata por composição: este formato "tem um" mata-mata.
 */
export class FaseDeGrupos implements FormatoTorneio {
  readonly tipo = 'GRUPOS_E_MATA_MATA' as const;
  private readonly mataMata = new MataMata();

  validarInicio(quantidade: number, regulamento: Readonly<RegulamentoProps>): void {
    garantir(
      quantidade >= regulamento.numeroGrupos * 2,
      `Com ${regulamento.numeroGrupos} grupos são necessárias pelo menos ${regulamento.numeroGrupos * 2} equipes`,
    );
  }

  /** Distribui as equipes em grupos pela ordem de inscrição (1ª no A, 2ª no B...). */
  gerarFaseInicial(ctx: ContextoFormato): Fase {
    const g = ctx.regulamento.numeroGrupos;
    const grupos: Grupo[] = Array.from({ length: g }, (_, i) => ({ nome: LETRAS[i], equipeIds: [] as Id[] }));
    ctx.equipes.forEach((e, i) => grupos[i % g].equipeIds.push(e.id));

    const partidas: Partida[] = grupos.flatMap((grupo) =>
      PontosCorridos.partidasDoGrupo(grupo.equipeIds, grupo.nome, ctx.regulamento),
    );
    return Fase.criar({ nome: 'Fase de grupos', tipo: 'GRUPOS', ordem: 1, grupos, partidas });
  }

  gerarProximaFase(faseAtual: Fase, ctx: ContextoFormato): Fase | null {
    if (faseAtual.tipo !== 'GRUPOS') return this.mataMata.gerarProximaFase(faseAtual);

    // 1º e 2º de cada grupo, já ordenados pelos critérios de desempate
    const classificados = faseAtual.grupos.map((grupo) => {
      const equipes = ctx.equipes.filter((e) => grupo.equipeIds.includes(e.id));
      const tabela = ctx.classificacao.calcular(equipes, faseAtual.partidasDoGrupo(grupo.nome));
      return { primeiro: tabela[0].equipeId, segundo: tabela[1].equipeId };
    });

    // R14: cruzamento 1A x 2B e 1B x 2A (e assim por diante em pares de grupos).
    // Os confrontos "de ida" ficam numa metade da chave e os "de volta" na outra,
    // assim equipes do mesmo grupo só podem se reencontrar na final.
    const ida: [Id, Id][] = [];
    const volta: [Id, Id][] = [];
    for (let i = 0; i < classificados.length; i += 2) {
      const a = classificados[i];
      const b = classificados[i + 1];
      ida.push([a.primeiro, b.segundo]);
      volta.push([b.primeiro, a.segundo]);
    }
    return this.mataMata.criarFase([...ida, ...volta], faseAtual.ordem + 1);
  }

  campeao(faseFinal: Fase): Id {
    return this.mataMata.campeao(faseFinal);
  }
}
