import {
  Campeonato,
  DadosDaInscricao,
  InscricaoComAprovacao,
  InscricaoFechada,
  InscricaoLivre,
  ModoDeInscricao,
  TipoModoInscricao,
  TransicaoInvalidaError,
} from '../../../src/domain';

const elenco = (prefixo: string, n = 3): DadosDaInscricao['jogadores'] =>
  Array.from({ length: n }, (_, i) => ({ nome: `${prefixo} ${i + 1}`, numero: i + 1, documento: `${prefixo}-${i}` }));

const novo = (modoInscricao: TipoModoInscricao) => {
  const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador', modoInscricao, regulamento: { minJogadores: 3, maxJogadores: 5 } });
  return c;
};

describe('Modo de inscrição (Strategy)', () => {
  it('cada modo decide o estado inicial do time do espectador', () => {
    expect(new InscricaoLivre().estadoInicialParaEspectador().status).toBe('APROVADA');
    expect(new InscricaoComAprovacao().estadoInicialParaEspectador().status).toBe('PENDENTE');
    expect(() => new InscricaoFechada().estadoInicialParaEspectador()).toThrow('fechadas');
    expect(ModoDeInscricao.de('LIVRE')).toBeInstanceOf(InscricaoLivre);
  });

  it('livre: o time entra aprovado', () => {
    const c = novo('LIVRE');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(e.status).toBe('APROVADA');
    expect(c.equipesAprovadas).toHaveLength(1);
  });

  it('com aprovação: fica pendente até um organizador decidir', () => {
    const c = novo('COM_APROVACAO');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(e.status).toBe('PENDENTE');
    expect(c.equipesAprovadas).toHaveLength(0);
    c.aprovarInscricao(e.id);
    expect(e.status).toBe('APROVADA');
  });

  it('fechada: espectador não inscreve', () => {
    const c = novo('FECHADA');
    expect(() => c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') })).toThrow('fechadas');
  });
});

describe('Inscrição do espectador', () => {
  it('R17: um time por conta', () => {
    const c = novo('LIVRE');
    c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(() => c.solicitarInscricao('u1', { nome: 'Tigres', jogadores: elenco('T') })).toThrow('já inscreveu');
  });

  it('R1 no envio: o elenco completo precisa respeitar mínimo e máximo', () => {
    const c = novo('LIVRE');
    expect(() => c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L', 2) })).toThrow('entre 3 e 5');
    expect(() => c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L', 6) })).toThrow('entre 3 e 5');
    expect(c.equipes).toHaveLength(0); // nada ficou pela metade
  });

  it('R2 no envio: documento repetido no elenco ou em outro time', () => {
    const c = novo('LIVRE');
    c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(() => c.solicitarInscricao('u2', { nome: 'Tigres', jogadores: elenco('L') })).toThrow('já está inscrito');
    const repetido = [...elenco('T', 2), { nome: 'Clone', numero: 9, documento: 'T-0' }];
    expect(() => c.solicitarInscricao('u2', { nome: 'Tigres', jogadores: repetido })).toThrow('duas vezes');
  });

  it('organizadores não usam a inscrição de espectador', () => {
    const c = novo('LIVRE');
    expect(() => c.solicitarInscricao('criador', { nome: 'Leões', jogadores: elenco('L') })).toThrow('área de equipes');
  });

  it('R20: recusada mostra o motivo e pode ser reenviada', () => {
    const c = novo('COM_APROVACAO');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(() => c.recusarInscricao(e.id, '')).toThrow('motivo');
    c.recusarInscricao(e.id, 'Elenco com nomes incompletos');
    expect(e.status).toBe('RECUSADA');
    expect(e.motivoRecusa).toBe('Elenco com nomes incompletos');
    expect(() => c.solicitarInscricao('u1', { nome: 'Leões 2', jogadores: elenco('X') })).toThrow('reenvie');

    c.reenviarInscricao('u1', { nome: 'Leões do Norte', jogadores: elenco('N', 4) });
    expect(e.status).toBe('PENDENTE');
    expect(e.nome).toBe('Leões do Norte');
    expect(e.jogadores).toHaveLength(4);
    expect(e.motivoRecusa).toBeNull();
  });

  it('State: não dá para aprovar duas vezes nem reenviar uma pendente', () => {
    const c = novo('COM_APROVACAO');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(() => c.reenviarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') })).toThrow(TransicaoInvalidaError);
    c.aprovarInscricao(e.id);
    expect(() => c.aprovarInscricao(e.id)).toThrow(TransicaoInvalidaError);
    expect(() => c.recusarInscricao(e.id, 'mudei de ideia')).toThrow(TransicaoInvalidaError);
  });

  it('inscrições pendentes impedem o início; recusadas saem quando começa', () => {
    const c = novo('COM_APROVACAO');
    const a = c.inscreverEquipe('Time A');
    const b = c.inscreverEquipe('Time B');
    for (const [eq, p] of [[a, 'A'], [b, 'B']] as const) {
      for (let i = 1; i <= 3; i++) c.adicionarJogador(eq.id, { nome: `J${p}${i}`, numero: i, documento: `${p}${i}` });
    }
    const pendente = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(() => c.iniciar()).toThrow('pendente');
    c.recusarInscricao(pendente.id, 'Fora do prazo');
    c.iniciar();
    expect(c.equipes.map((e) => e.nome)).toEqual(['Time A', 'Time B']);
  });

  it('R21: banido não inscreve; banir recusa o time pendente', () => {
    const c = novo('COM_APROVACAO');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    c.banir('u1', 'INSCRICAO', 'inscrições falsas', 'criador');
    expect(e.status).toBe('RECUSADA');
    expect(e.motivoRecusa).toContain('inscrições falsas');
    expect(() => c.reenviarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') })).toThrow('impedida');
    c.desbanir('u1');
    c.reenviarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    expect(e.status).toBe('PENDENTE');
  });

  it('organizadores não podem ser banidos', () => {
    const c = novo('LIVRE');
    expect(() => c.banir('criador', 'VISUALIZACAO', '', 'outro')).toThrow('não podem ser banidos');
  });
});

describe('Configuração e regulamento', () => {
  it('R18: regulamento muda antes do início, mas trava depois', () => {
    const c = novo('FECHADA');
    c.alterarRegulamento({ pontosVitoria: 2 });
    expect(c.regulamento.props.pontosVitoria).toBe(2);
    expect(() => c.alterarRegulamento({ pontosVitoria: 0 })).toThrow('vitória > empate');
    expect(c.regulamento.props.pontosVitoria).toBe(2); // o inválido não substituiu o válido
  });

  it('regulamento novo não pode deixar um time acima do máximo', () => {
    const c = novo('LIVRE');
    c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L', 5) });
    expect(() => c.alterarRegulamento({ maxJogadores: 4 })).toThrow('acima do novo máximo');
  });

  it('visibilidade e modo mudam a qualquer momento; privado + inscrição aberta gera aviso', () => {
    const c = novo('FECHADA');
    expect(c.avisosDeConfiguracao()).toEqual([]);
    c.alterarVisibilidade('PRIVADA');
    c.alterarModoInscricao('LIVRE');
    expect(c.avisosDeConfiguracao()[0]).toContain('privado');
    c.alterarDadosBasicos({ nome: 'Copa Nova' });
    expect(c.nome).toBe('Copa Nova');
    expect(() => c.alterarDadosBasicos({ nome: 'X' })).toThrow('3 caracteres');
  });

  it('regenerar a chave invalida o link antigo', () => {
    const c = novo('FECHADA');
    const antiga = c.chaveDeAcesso.valor;
    c.regenerarChaveDeAcesso();
    expect(c.chaveDeAcesso.confere(antiga)).toBe(false);
    expect(c.chaveDeAcesso.confere(c.chaveDeAcesso.valor)).toBe(true);
  });

  it('snapshot → restaurar mantém tudo o que é novo', () => {
    const c = novo('COM_APROVACAO');
    c.alterarVisibilidade('PRIVADA');
    const e = c.solicitarInscricao('u1', { nome: 'Leões', jogadores: elenco('L') });
    c.recusarInscricao(e.id, 'Faltou documento');
    c.banir('u2', 'VISUALIZACAO', 'spam', 'criador');
    c.gerarLinkDeConvite('criador');
    expect(Campeonato.restaurar(structuredClone(c.snapshot())).snapshot()).toEqual(c.snapshot());
  });
});
