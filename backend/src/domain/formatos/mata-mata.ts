import { RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id } from '../compartilhado/id';
import { Fase } from '../entidades/fase';
import { Partida } from '../entidades/partida';
import { ContextoFormato, FormatoTorneio } from './formato-torneio';

const potenciaDeDois = (n: number) => n >= 2 && (n & (n - 1)) === 0;

/** Eliminação simples. Vencedores das posições 2k e 2k+1 se enfrentam na fase seguinte. */
export class MataMata implements FormatoTorneio {
  readonly tipo = 'MATA_MATA' as const;

  validarInicio(quantidade: number): void {
    garantir(potenciaDeDois(quantidade), 'Mata-mata precisa de 2, 4, 8, 16 ou 32 equipes');
  }

  /** Cabeças de chave pela ordem de inscrição: 1º x último, 2º x penúltimo... */
  gerarFaseInicial(ctx: ContextoFormato): Fase {
    const ids = ctx.equipes.map((e) => e.id);
    const confrontos: [Id, Id][] = [];
    for (let i = 0; i < ids.length / 2; i++) confrontos.push([ids[i], ids[ids.length - 1 - i]]);
    return this.criarFase(confrontos, 1);
  }

  gerarProximaFase(faseAtual: Fase): Fase | null {
    if (faseAtual.partidas.length === 1) return null; // era a final
    const vencedores = [...faseAtual.partidas]
      .sort((a, b) => a.posicao - b.posicao)
      .map((p) => MataMata.vencedorObrigatorio(p));
    const confrontos: [Id, Id][] = [];
    for (let i = 0; i < vencedores.length; i += 2) confrontos.push([vencedores[i], vencedores[i + 1]]);
    return this.criarFase(confrontos, faseAtual.ordem + 1);
  }

  campeao(faseFinal: Fase): Id {
    garantir(faseFinal.partidas.length === 1, 'A fase final do mata-mata deve ter uma única partida');
    return MataMata.vencedorObrigatorio(faseFinal.partidas[0]);
  }

  /** Usado também pela fase de grupos (composição em vez de herança). */
  criarFase(confrontos: [Id, Id][], ordem: number): Fase {
    return Fase.criar({
      nome: MataMata.nomeDaFase(confrontos.length * 2),
      tipo: 'MATA_MATA',
      ordem,
      partidas: confrontos.map(([m, v], i) =>
        Partida.agendar({ rodada: 1, mandanteId: m, visitanteId: v, posicao: i, eliminatoria: true }),
      ),
    });
  }

  static nomeDaFase(equipes: number): string {
    const nomes: Record<number, string> = {
      2: 'Final',
      4: 'Semifinal',
      8: 'Quartas de final',
      16: 'Oitavas de final',
      32: '16-avos de final',
    };
    return nomes[equipes] ?? `Fase de ${equipes}`;
  }

  private static vencedorObrigatorio(p: Partida): Id {
    const v = p.vencedorId();
    if (!v) throw new RegraDeNegocioError('Há partida eliminatória sem vencedor definido');
    return v;
  }
}
