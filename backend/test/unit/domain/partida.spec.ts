import { JogadorSuspensoError, Partida, TransicaoInvalidaError } from '../../../src/domain';

const livre = { jogadorSuspenso: false };

function partidaEmAndamento(eliminatoria = false) {
  const p = Partida.agendar({ rodada: 1, mandanteId: 'A', visitanteId: 'B', eliminatoria });
  p.iniciar();
  return p;
}

describe('Partida — súmula e State pattern', () => {
  it('nasce agendada e não aceita eventos antes de iniciar', () => {
    const p = Partida.agendar({ rodada: 1, mandanteId: 'A', visitanteId: 'B' });
    expect(p.status).toBe('AGENDADA');
    expect(() => p.registrarEvento('GOL', 'j1', 'A', 5, livre)).toThrow(TransicaoInvalidaError);
  });

  it('não pode ser finalizada sem ter sido iniciada', () => {
    const p = Partida.agendar({ rodada: 1, mandanteId: 'A', visitanteId: 'B' });
    expect(() => p.finalizar()).toThrow(TransicaoInvalidaError);
  });

  it('não pode ser iniciada duas vezes', () => {
    const p = partidaEmAndamento();
    expect(() => p.iniciar()).toThrow(TransicaoInvalidaError);
  });

  it('calcula o placar a partir dos gols', () => {
    const p = partidaEmAndamento();
    p.registrarEvento('GOL', 'j1', 'A', 5, livre);
    p.registrarEvento('GOL', 'j1', 'A', 15, livre);
    p.registrarEvento('GOL', 'j9', 'B', 30, livre);
    expect(p.placar()).toEqual({ mandante: 2, visitante: 1 });
    expect(p.resultadoPara('A')).toBe('VITORIA');
    expect(p.resultadoPara('B')).toBe('DERROTA');
  });

  it('R12: rejeita evento de equipe que não está na partida', () => {
    const p = partidaEmAndamento();
    expect(() => p.registrarEvento('GOL', 'jx', 'C', 5, livre)).toThrow('não pertence');
  });

  it('R11: rejeita evento de jogador suspenso', () => {
    const p = partidaEmAndamento();
    expect(() => p.registrarEvento('GOL', 'j1', 'A', 5, { jogadorSuspenso: true })).toThrow(JogadorSuspensoError);
  });

  it('segundo amarelo na mesma partida gera vermelho automático', () => {
    const p = partidaEmAndamento();
    p.registrarEvento('CARTAO_AMARELO', 'j1', 'A', 10, livre);
    const criados = p.registrarEvento('CARTAO_AMARELO', 'j1', 'A', 40, livre);
    expect(criados.map((e) => e.tipo)).toEqual(['CARTAO_AMARELO', 'CARTAO_VERMELHO']);
    expect(p.foiExpulso('j1')).toBe(true);
  });

  it('jogador expulso não pode marcar gol depois', () => {
    const p = partidaEmAndamento();
    p.registrarEvento('CARTAO_VERMELHO', 'j1', 'A', 10, livre);
    expect(() => p.registrarEvento('GOL', 'j1', 'A', 20, livre)).toThrow('expulso');
  });

  it('remover um dos amarelos desfaz a expulsão automática', () => {
    const p = partidaEmAndamento();
    const [amarelo] = p.registrarEvento('CARTAO_AMARELO', 'j1', 'A', 10, livre);
    p.registrarEvento('CARTAO_AMARELO', 'j1', 'A', 40, livre);
    p.removerEvento(amarelo.id);
    expect(p.foiExpulso('j1')).toBe(false);
    expect(p.amarelosDo('j1')).toBe(1);
  });

  it('R15: partida finalizada não aceita novos eventos', () => {
    const p = partidaEmAndamento();
    p.finalizar();
    expect(p.status).toBe('FINALIZADA');
    expect(() => p.registrarEvento('GOL', 'j1', 'A', 5, livre)).toThrow(TransicaoInvalidaError);
  });

  describe('R13: partidas eliminatórias', () => {
    it('empate exige pênaltis', () => {
      const p = partidaEmAndamento(true);
      expect(() => p.finalizar()).toThrow('pênaltis');
    });

    it('pênaltis precisam ter vencedor', () => {
      const p = partidaEmAndamento(true);
      expect(() => p.finalizar({ mandante: 4, visitante: 4 })).toThrow('vencedor');
    });

    it('vencedor sai dos pênaltis quando empata no tempo normal', () => {
      const p = partidaEmAndamento(true);
      p.finalizar({ mandante: 3, visitante: 5 });
      expect(p.vencedorId()).toBe('B');
    });

    it('pênaltis são ignorados quando não houve empate', () => {
      const p = partidaEmAndamento(true);
      p.registrarEvento('GOL', 'j1', 'A', 5, livre);
      p.finalizar({ mandante: 0, visitante: 5 });
      expect(p.penaltis).toBeNull();
      expect(p.vencedorId()).toBe('A');
    });
  });

  it('snapshot e restauração preservam o estado', () => {
    const p = partidaEmAndamento();
    p.registrarEvento('GOL', 'j1', 'A', 5, livre);
    const copia = Partida.restaurar(p.snapshot());
    expect(copia.status).toBe('EM_ANDAMENTO');
    expect(copia.placar()).toEqual({ mandante: 1, visitante: 0 });
  });
});
