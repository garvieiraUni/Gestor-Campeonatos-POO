import { Campeonato, Equipe, Partida, Placar, RegulamentoProps } from '../../src/domain';

/** Builder de teste: monta um campeonato com N equipes completas, pronto para iniciar. */
export class CampeonatoBuilder {
  private equipes = 4;
  private jogadoresPorEquipe = 5;
  private regulamento: Partial<RegulamentoProps> = { minJogadores: 5 };

  static umCampeonato(): CampeonatoBuilder {
    return new CampeonatoBuilder();
  }

  comEquipes(n: number): this {
    this.equipes = n;
    return this;
  }

  comJogadoresPorEquipe(n: number): this {
    this.jogadoresPorEquipe = n;
    return this;
  }

  comRegulamento(r: Partial<RegulamentoProps>): this {
    this.regulamento = { ...this.regulamento, ...r };
    return this;
  }

  build(): Campeonato {
    const c = Campeonato.criar({ nome: 'Copa de Teste', criadorId: 'org-1', regulamento: this.regulamento });
    for (let i = 0; i < this.equipes; i++) {
      const e = c.inscreverEquipe(`Time ${String.fromCharCode(65 + i)}`);
      for (let j = 0; j < this.jogadoresPorEquipe; j++) {
        c.adicionarJogador(e.id, { nome: `Jogador ${i}-${j}`, numero: j + 1, documento: `doc-${i}-${j}` });
      }
    }
    return c;
  }

  iniciado(): Campeonato {
    const c = this.build();
    c.iniciar();
    return c;
  }
}

export const equipe = (c: Campeonato, nome: string): Equipe => c.equipes.find((e) => e.nome === nome)!;

export const partidaDe = (c: Campeonato, nomeEquipe: string, rodada?: number): Partida =>
  c.faseAtual!.partidas.find(
    (p) => !p.finalizada && p.envolve(equipe(c, nomeEquipe).id) && (rodada === undefined || p.rodada === rodada),
  )!;

/**
 * Joga uma partida com o placar dado. Os gols saem do último jogador do elenco
 * (os testes de cartão usam os primeiros, para não colidir com suspensões).
 */
export function jogar(c: Campeonato, partida: Partida, gm: number, gv: number, penaltis?: Placar): void {
  c.iniciarPartida(partida.id);
  const artilheiro = (equipeId: string) => {
    const js = c.obterEquipe(equipeId).jogadores;
    return js[js.length - 1].id;
  };
  for (let i = 0; i < gm; i++) c.registrarEvento(partida.id, { tipo: 'GOL', jogadorId: artilheiro(partida.mandanteId), minuto: 10 + i });
  for (let i = 0; i < gv; i++) c.registrarEvento(partida.id, { tipo: 'GOL', jogadorId: artilheiro(partida.visitanteId), minuto: 20 + i });
  c.finalizarPartida(partida.id, penaltis);
}

/** Finaliza todas as partidas pendentes da fase atual com vitória do mandante por 1 x 0. */
export function jogarFaseInteira(c: Campeonato, placar: (p: Partida) => [number, number] = () => [1, 0]): void {
  for (const p of [...c.faseAtual!.partidas].filter((x) => !x.finalizada)) {
    const [gm, gv] = placar(p);
    jogar(c, p, gm, gv);
  }
}
