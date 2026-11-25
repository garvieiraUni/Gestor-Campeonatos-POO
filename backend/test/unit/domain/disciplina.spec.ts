import { Campeonato, JogadorSuspensoError, Partida, TipoEvento } from '../../../src/domain';
import { CampeonatoBuilder, equipe, partidaDe } from '../../builders/campeonato.builder';

/** Joga a partida aplicando os cartões dados (sem gols). */
function jogarComCartoes(c: Campeonato, p: Partida, cartoes: { jogadorId: string; tipo: TipoEvento }[] = []) {
  c.iniciarPartida(p.id);
  cartoes.forEach((x, i) => c.registrarEvento(p.id, { tipo: x.tipo, jogadorId: x.jogadorId, minuto: 10 + i }));
  c.finalizarPartida(p.id);
}

/** Joga todas as partidas da rodada; cartões só na partida do Time A. */
function jogarRodada(c: Campeonato, rodada: number, cartoesDoTimeA: { jogadorId: string; tipo: TipoEvento }[] = []) {
  const doA = partidaDe(c, 'Time A', rodada);
  for (const p of c.faseAtual!.partidas.filter((x) => x.rodada === rodada && !x.finalizada)) {
    jogarComCartoes(c, p, p === doA ? cartoesDoTimeA : []);
  }
}

describe('Controle disciplinar (Observer)', () => {
  let c: Campeonato;
  let craque: string;

  beforeEach(() => {
    c = CampeonatoBuilder.umCampeonato().comEquipes(4).iniciado(); // 3 rodadas
    craque = equipe(c, 'Time A').jogadores[0].id;
  });

  it('R9: dois amarelos em partidas diferentes geram 1 jogo de suspensão', () => {
    jogarRodada(c, 1, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    expect(c.suspensoes).toHaveLength(0);

    jogarRodada(c, 2, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    expect(c.suspensoes).toHaveLength(1);
    expect(c.suspensoes[0]).toMatchObject({ motivo: 'ACUMULO_DE_AMARELOS', jogosRestantes: 1 });
  });

  it('R11: suspenso não pode ter evento na partida seguinte', () => {
    jogarRodada(c, 1, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    jogarRodada(c, 2, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);

    const proxima = partidaDe(c, 'Time A', 3);
    c.iniciarPartida(proxima.id);
    expect(() => c.registrarEvento(proxima.id, { tipo: 'GOL', jogadorId: craque, minuto: 5 })).toThrow(JogadorSuspensoError);
  });

  it('a suspensão é cumprida quando a equipe joga', () => {
    jogarRodada(c, 1, [{ jogadorId: craque, tipo: 'CARTAO_VERMELHO' }]);
    const suspensao = c.suspensoes[0];
    expect(suspensao.ativa).toBe(true);

    jogarRodada(c, 2);
    expect(suspensao.ativa).toBe(false);
    expect(suspensao.partidasCumpridas).toEqual([expect.any(String)]);

    const rodada3 = partidaDe(c, 'Time A', 3);
    expect(c.estaSuspenso(craque, rodada3.id)).toBe(false);
  });

  it('R10: vermelho direto suspende pelo número de jogos do regulamento', () => {
    c = CampeonatoBuilder.umCampeonato().comEquipes(4).comRegulamento({ jogosSuspensaoVermelho: 2 }).iniciado();
    craque = equipe(c, 'Time A').jogadores[0].id;

    jogarRodada(c, 1, [{ jogadorId: craque, tipo: 'CARTAO_VERMELHO' }]);
    jogarRodada(c, 2);
    expect(c.estaSuspenso(craque, partidaDe(c, 'Time A', 3).id)).toBe(true);
    expect(c.suspensoes[0].jogosRestantes).toBe(1);
  });

  it('amarelos da partida em que foi expulso não contam para acúmulo', () => {
    jogarRodada(c, 1, [
      { jogadorId: craque, tipo: 'CARTAO_AMARELO' },
      { jogadorId: craque, tipo: 'CARTAO_AMARELO' }, // vira vermelho
    ]);
    expect(c.suspensoes).toHaveLength(1);
    expect(c.suspensoes[0].motivo).toBe('CARTAO_VERMELHO');

    jogarRodada(c, 2); // cumpre
    jogarRodada(c, 3, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    expect(c.suspensoes).toHaveLength(1); // só 1 amarelo válido acumulado
  });

  it('o limite de amarelos é configurável', () => {
    c = CampeonatoBuilder.umCampeonato().comEquipes(4).comRegulamento({ amarelosParaSuspensao: 3 }).iniciado();
    craque = equipe(c, 'Time A').jogadores[0].id;
    jogarRodada(c, 1, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    jogarRodada(c, 2, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    expect(c.suspensoes).toHaveLength(0);
    jogarRodada(c, 3, [{ jogadorId: craque, tipo: 'CARTAO_AMARELO' }]);
    expect(c.suspensoes).toHaveLength(1);
  });

  it('suspensão atravessa fases (grupos → mata-mata)', () => {
    c = CampeonatoBuilder.umCampeonato()
      .comEquipes(4)
      .comRegulamento({ formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 2 })
      .iniciado();
    // cada grupo tem 2 equipes → 1 partida por grupo
    craque = equipe(c, 'Time A').jogadores[0].id;
    const [g1, g2] = c.faseAtual!.partidas;
    const partidaDoA = g1.envolve(equipe(c, 'Time A').id) ? g1 : g2;
    const outra = partidaDoA === g1 ? g2 : g1;

    c.iniciarPartida(partidaDoA.id);
    c.registrarEvento(partidaDoA.id, { tipo: 'GOL', jogadorId: equipe(c, 'Time A').jogadores[4].id, minuto: 1 });
    c.registrarEvento(partidaDoA.id, { tipo: 'CARTAO_VERMELHO', jogadorId: craque, minuto: 2 });
    c.finalizarPartida(partidaDoA.id);
    jogarComCartoes(c, outra);

    expect(c.faseAtual!.nome).toBe('Semifinal');
    const semi = partidaDe(c, 'Time A');
    expect(c.estaSuspenso(craque, semi.id)).toBe(true);
  });
});
