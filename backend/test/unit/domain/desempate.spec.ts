import {
  CadeiaDeDesempateFactory,
  Classificacao,
  LinhaTabela,
  Partida,
  PontuacaoPorResultado,
} from '../../../src/domain';

const linha = (nome: string, dados: Partial<LinhaTabela> = {}) => Object.assign(new LinhaTabela(nome, nome), dados);
const pontuacao = new PontuacaoPorResultado();
const ctxVazio = { partidas: [], pontuacao };

/** Cria uma partida finalizada com o placar dado (o jogador é fictício: só o gol importa). */
function jogo(m: string, v: string, gm: number, gv: number, cartoes: { equipe: string; tipo: 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' }[] = []) {
  const p = Partida.agendar({ rodada: 1, mandanteId: m, visitanteId: v });
  p.iniciar();
  const ctx = { jogadorSuspenso: false };
  for (let i = 0; i < gm; i++) p.registrarEvento('GOL', `j-${m}`, m, i, ctx);
  for (let i = 0; i < gv; i++) p.registrarEvento('GOL', `j-${v}`, v, i, ctx);
  cartoes.forEach((c, i) => p.registrarEvento(c.tipo, `c-${c.equipe}-${i}`, c.equipe, 50, ctx));
  p.finalizar();
  return p;
}

describe('Critérios de desempate (R7) — Chain of Responsibility', () => {
  const cadeia = CadeiaDeDesempateFactory.criar(['PONTOS', 'VITORIAS', 'SALDO_DE_GOLS', 'GOLS_PRO', 'FAIR_PLAY']);
  const ordenar = (...ls: LinhaTabela[]) => ls.sort((a, b) => cadeia.comparar(a, b, ctxVazio)).map((l) => l.nome);

  it('mais pontos fica na frente', () => {
    expect(ordenar(linha('A', { pontos: 3 }), linha('B', { pontos: 6 }))).toEqual(['B', 'A']);
  });

  it('empate em pontos: vence quem tem mais vitórias', () => {
    expect(ordenar(linha('A', { pontos: 3, vitorias: 0 }), linha('B', { pontos: 3, vitorias: 1 }))).toEqual(['B', 'A']);
  });

  it('empate em pontos e vitórias: vence quem tem maior saldo', () => {
    const a = linha('A', { pontos: 3, vitorias: 1, golsPro: 2, golsContra: 1 });
    const b = linha('B', { pontos: 3, vitorias: 1, golsPro: 4, golsContra: 1 });
    expect(ordenar(a, b)).toEqual(['B', 'A']);
  });

  it('empate em saldo: vence quem marcou mais gols', () => {
    const a = linha('A', { pontos: 3, vitorias: 1, golsPro: 2, golsContra: 1 });
    const b = linha('B', { pontos: 3, vitorias: 1, golsPro: 3, golsContra: 2 });
    expect(ordenar(a, b)).toEqual(['B', 'A']);
  });

  it('fair play (R8): menos pontos de cartão fica à frente', () => {
    const a = linha('A', { pontos: 3, pontosFairPlay: 4 });
    const b = linha('B', { pontos: 3, pontosFairPlay: 1 });
    expect(ordenar(a, b)).toEqual(['B', 'A']);
  });

  it('tudo igual: ordem alfabética garante resultado estável', () => {
    expect(ordenar(linha('Zebra'), linha('Avaí'))).toEqual(['Avaí', 'Zebra']);
  });

  it('a ordem dos critérios é a do regulamento', () => {
    const golsAntes = CadeiaDeDesempateFactory.criar(['PONTOS', 'GOLS_PRO', 'SALDO_DE_GOLS']);
    const a = linha('A', { pontos: 3, golsPro: 5, golsContra: 5 }); // saldo 0
    const b = linha('B', { pontos: 3, golsPro: 2, golsContra: 0 }); // saldo +2
    expect([a, b].sort((x, y) => golsAntes.comparar(x, y, ctxVazio)).map((l) => l.nome)).toEqual(['A', 'B']);
  });

  it('confronto direto usa só os jogos entre as duas equipes', () => {
    const cadeiaCD = CadeiaDeDesempateFactory.criar(['PONTOS', 'CONFRONTO_DIRETO']);
    const partidas = [jogo('A', 'B', 0, 1)];
    const a = linha('A', { pontos: 3 });
    const b = linha('B', { pontos: 3 });
    expect(cadeiaCD.comparar(a, b, { partidas, pontuacao })).toBeGreaterThan(0); // B na frente
  });
});

describe('Classificacao — cálculo da tabela', () => {
  const classificacao = new Classificacao(pontuacao, CadeiaDeDesempateFactory.criar(['PONTOS', 'SALDO_DE_GOLS', 'FAIR_PLAY']));
  const equipes = ['A', 'B', 'C'].map((id) => ({ id, nome: id }));

  it('pontuação padrão 3 / 1 / 0 (R4) e estatísticas corretas', () => {
    const tabela = classificacao.calcular(equipes, [jogo('A', 'B', 2, 0), jogo('B', 'C', 1, 1), jogo('C', 'A', 0, 3)]);
    const [a, b, c] = tabela;
    expect(a).toMatchObject({ equipeId: 'A', posicao: 1, pontos: 6, jogos: 2, vitorias: 2, golsPro: 5, golsContra: 0 });
    // B e C empatam com 1 ponto; B fica à frente pelo saldo (-2 contra -3)
    expect(b).toMatchObject({ equipeId: 'B', posicao: 2, pontos: 1, empates: 1, derrotas: 1 });
    expect(c).toMatchObject({ equipeId: 'C', posicao: 3, pontos: 1 });
    expect(b.saldo).toBe(-2);
    expect(c.saldo).toBe(-3);
  });

  it('ignora partidas que não estão finalizadas', () => {
    const emAberto = Partida.agendar({ rodada: 1, mandanteId: 'A', visitanteId: 'B' });
    const tabela = classificacao.calcular(equipes, [emAberto]);
    expect(tabela.every((l) => l.jogos === 0)).toBe(true);
  });

  it('pontuação configurável: vitória valendo 2', () => {
    const c2 = new Classificacao(new PontuacaoPorResultado(2, 1, 0), CadeiaDeDesempateFactory.criar(['PONTOS']));
    expect(c2.calcular(equipes, [jogo('A', 'B', 1, 0)])[0]).toMatchObject({ equipeId: 'A', pontos: 2 });
  });

  it('cartões somam pontos de fair play: amarelo 1, vermelho 3', () => {
    const tabela = classificacao.calcular(equipes, [
      jogo('A', 'B', 0, 0, [
        { equipe: 'A', tipo: 'CARTAO_AMARELO' },
        { equipe: 'B', tipo: 'CARTAO_VERMELHO' },
      ]),
    ]);
    expect(tabela.find((l) => l.equipeId === 'A')!.pontosFairPlay).toBe(1);
    expect(tabela.find((l) => l.equipeId === 'B')!.pontosFairPlay).toBe(3);
  });
});

describe('PontuacaoPorResultado', () => {
  it('rejeita pontuação incoerente', () => {
    expect(() => new PontuacaoPorResultado(1, 2, 0)).toThrow('vitória > empate');
  });
});
