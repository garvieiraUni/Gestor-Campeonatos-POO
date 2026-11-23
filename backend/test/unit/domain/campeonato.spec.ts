import { Campeonato, Partida, TransicaoInvalidaError } from '../../../src/domain';
import { CampeonatoBuilder, equipe, jogar, jogarFaseInteira } from '../../builders/campeonato.builder';

/** Time A é o mais forte, Time B o segundo... quem tem a letra menor vence por 2 x 0. */
const forcaPorLetra = (c: Campeonato) => (p: Partida): [number, number] => {
  const nome = (id: string) => c.obterEquipe(id).nome;
  return nome(p.mandanteId) < nome(p.visitanteId) ? [2, 0] : [0, 2];
};
const nomes = (c: Campeonato, p: Partida) => [c.obterEquipe(p.mandanteId).nome, c.obterEquipe(p.visitanteId).nome];

describe('Campeonato — inscrições', () => {
  it('nasce com inscrições abertas e regulamento padrão', () => {
    const c = Campeonato.criar({ nome: 'Copa', organizadorId: 'org' });
    expect(c.status).toBe('INSCRICOES_ABERTAS');
    expect(c.regulamento.props.pontosVitoria).toBe(3);
  });

  it('não aceita duas equipes com o mesmo nome', () => {
    const c = Campeonato.criar({ nome: 'Copa', organizadorId: 'org' });
    c.inscreverEquipe('Leões');
    expect(() => c.inscreverEquipe('leões')).toThrow('Já existe');
  });

  it('R1: respeita o máximo de jogadores por equipe', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(1).comJogadoresPorEquipe(3).comRegulamento({ minJogadores: 1, maxJogadores: 3 }).build();
    const e = c.equipes[0];
    expect(() => c.adicionarJogador(e.id, { nome: 'Extra', numero: 50, documento: 'x' })).toThrow('limite de 3');
  });

  it('R1: não inicia se alguma equipe tiver menos que o mínimo', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(4).comJogadoresPorEquipe(4).comRegulamento({ minJogadores: 5 }).build();
    expect(() => c.iniciar()).toThrow('o mínimo é 5');
    expect(c.status).toBe('INSCRICOES_ABERTAS');
  });

  it('R2: o mesmo jogador não pode estar em duas equipes', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(2).build();
    const [a, b] = c.equipes;
    c.adicionarJogador(a.id, { nome: 'Pelé', numero: 10, documento: 'RA-123' });
    expect(() => c.adicionarJogador(b.id, { nome: 'Pelé', numero: 10, documento: 'ra-123' })).toThrow('já está inscrito');
  });

  it('camisa não pode repetir dentro da equipe', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(1).build();
    expect(() => c.adicionarJogador(c.equipes[0].id, { nome: 'Novo', numero: 1, documento: 'n1' })).toThrow('camisa 1');
  });

  it('R3: depois de iniciado, o elenco fecha', () => {
    const c = CampeonatoBuilder.umCampeonato().iniciado();
    expect(() => c.inscreverEquipe('Atrasados')).toThrow(TransicaoInvalidaError);
    expect(() => c.adicionarJogador(c.equipes[0].id, { nome: 'Novo', numero: 77, documento: 'n77' })).toThrow(TransicaoInvalidaError);
  });

  it('precisa de pelo menos 2 equipes', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(1).build();
    expect(() => c.iniciar()).toThrow('pelo menos 2 equipes');
  });

  it('não pode iniciar duas vezes', () => {
    const c = CampeonatoBuilder.umCampeonato().iniciado();
    expect(() => c.iniciar()).toThrow(TransicaoInvalidaError);
  });
});

describe('Campeonato — regulamento', () => {
  it('primeiro critério tem de ser PONTOS', () => {
    expect(() => Campeonato.criar({ nome: 'Copa', organizadorId: 'o', regulamento: { criteriosDesempate: ['SALDO_DE_GOLS'] } })).toThrow('PONTOS');
  });

  it('máximo de jogadores não pode ser menor que o mínimo', () => {
    expect(() => Campeonato.criar({ nome: 'Copa', organizadorId: 'o', regulamento: { minJogadores: 10, maxJogadores: 5 } })).toThrow('máximo');
  });
});

describe('Formato pontos corridos', () => {
  it('gera todas as rodadas ao iniciar', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(6).iniciado();
    expect(c.status).toBe('EM_ANDAMENTO');
    expect(c.fases).toHaveLength(1);
    expect(c.faseAtual!.partidas).toHaveLength(15);
  });

  it('R16: encerra sozinho quando a última partida termina e define o campeão', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(4).iniciado();
    jogarFaseInteira(c, forcaPorLetra(c));
    expect(c.status).toBe('ENCERRADO');
    expect(c.campeaoId).toBe(equipe(c, 'Time A').id);
  });

  it('não aceita eventos depois de encerrado', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(2).iniciado();
    const p = c.faseAtual!.partidas[0];
    jogar(c, p, 1, 0);
    expect(() => c.iniciarPartida(p.id)).toThrow(TransicaoInvalidaError);
  });
});

describe('Formato mata-mata', () => {
  const regulamento = { formato: 'MATA_MATA' as const };

  it('exige potência de 2', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(6).comRegulamento(regulamento).build();
    expect(() => c.iniciar()).toThrow('2, 4, 8');
  });

  it('cruza 1º x último e avança os vencedores até a final', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(4).comRegulamento(regulamento).iniciado();
    expect(c.faseAtual!.nome).toBe('Semifinal');
    expect(c.faseAtual!.partidas.map((p) => nomes(c, p))).toEqual([
      ['Time A', 'Time D'],
      ['Time B', 'Time C'],
    ]);

    jogarFaseInteira(c, forcaPorLetra(c));
    expect(c.faseAtual!.nome).toBe('Final');
    expect(nomes(c, c.faseAtual!.partidas[0])).toEqual(['Time A', 'Time B']);

    jogarFaseInteira(c, forcaPorLetra(c));
    expect(c.status).toBe('ENCERRADO');
    expect(c.campeaoId).toBe(equipe(c, 'Time A').id);
  });

  it('pênaltis decidem quem avança', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(4).comRegulamento(regulamento).iniciado();
    const [semi1, semi2] = c.faseAtual!.partidas;
    jogar(c, semi1, 1, 1, { mandante: 3, visitante: 4 }); // Time D vence nos pênaltis
    jogar(c, semi2, 2, 0);
    expect(nomes(c, c.faseAtual!.partidas[0])).toEqual(['Time D', 'Time B']);
  });
});

describe('Formato grupos + mata-mata', () => {
  it('R14: 1º do A pega o 2º do B e vice-versa', () => {
    const c = CampeonatoBuilder.umCampeonato()
      .comEquipes(8)
      .comRegulamento({ formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 2 })
      .iniciado();

    const grupos = c.faseAtual!.grupos;
    expect(grupos.map((g) => g.nome)).toEqual(['A', 'B']);
    expect(grupos[0].equipeIds.map((id) => c.obterEquipe(id).nome)).toEqual(['Time A', 'Time C', 'Time E', 'Time G']);
    expect(c.faseAtual!.partidas).toHaveLength(12);

    jogarFaseInteira(c, forcaPorLetra(c));

    // Grupo A: Time A 1º, Time C 2º. Grupo B: Time B 1º, Time D 2º.
    expect(c.faseAtual!.nome).toBe('Semifinal');
    expect(c.faseAtual!.partidas.map((p) => nomes(c, p))).toEqual([
      ['Time A', 'Time D'],
      ['Time B', 'Time C'],
    ]);

    jogarFaseInteira(c, forcaPorLetra(c));
    jogarFaseInteira(c, forcaPorLetra(c));
    expect(c.status).toBe('ENCERRADO');
    expect(c.campeaoId).toBe(equipe(c, 'Time A').id);
    expect(c.fases.map((f) => f.nome)).toEqual(['Fase de grupos', 'Semifinal', 'Final']);
  });

  it('com 4 grupos, equipes do mesmo grupo ficam em lados opostos da chave', () => {
    const c = CampeonatoBuilder.umCampeonato()
      .comEquipes(16)
      .comRegulamento({ formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 4 })
      .iniciado();
    jogarFaseInteira(c, forcaPorLetra(c));
    expect(c.faseAtual!.nome).toBe('Quartas de final');
    const [q1, q2, q3, q4] = c.faseAtual!.partidas.map((p) => nomes(c, p));
    // grupos: A={A,E,I,M} B={B,F,J,N} C={C,G,K,O} D={D,H,L,P}
    expect([q1, q2, q3, q4]).toEqual([
      ['Time A', 'Time F'],
      ['Time C', 'Time H'],
      ['Time B', 'Time E'],
      ['Time D', 'Time G'],
    ]);
  });

  it('exige equipes suficientes para os grupos', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(3).comRegulamento({ formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 2 }).build();
    expect(() => c.iniciar()).toThrow('pelo menos 4 equipes');
  });
});

describe('Consultas', () => {
  it('artilharia ordena por gols', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(2).iniciado();
    jogar(c, c.faseAtual!.partidas[0], 3, 1);
    const [primeiro, segundo] = c.artilharia();
    expect(primeiro.gols).toBe(3);
    expect(segundo.gols).toBe(1);
  });

  it('snapshot e restauração reconstroem o agregado inteiro', () => {
    const c = CampeonatoBuilder.umCampeonato().comEquipes(4).iniciado();
    jogar(c, c.faseAtual!.partidas[0], 2, 1);
    const copia = Campeonato.restaurar(c.snapshot());
    expect(copia.snapshot()).toEqual(c.snapshot());
    expect(copia.tabelas()[0].linhas[0].pontos).toBe(3);
  });
});
