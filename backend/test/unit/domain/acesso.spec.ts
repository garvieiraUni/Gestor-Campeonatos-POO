import {
  Acao,
  AdministradorGlobal,
  Ator,
  Bloqueado,
  Campeonato,
  Criador,
  Espectador,
  OrganizadorConvidado,
  PapelNoCampeonato,
  PoliticaDeAcesso,
  Usuario,
  Visitante,
} from '../../../src/domain';

const conta = (nome: string, adm = false) => {
  const u = Usuario.criar(nome, `${nome.toLowerCase()}@teste.com`, 'hash');
  if (adm) u.promoverAAdministrador();
  return u;
};

describe('Papéis no campeonato (herança em cadeia)', () => {
  const cadeia: PapelNoCampeonato[] = [
    new Bloqueado(),
    new Visitante(),
    new Espectador(),
    new OrganizadorConvidado(),
    new Criador(),
    new AdministradorGlobal(),
  ];

  it('cada papel tem todas as permissões do anterior (Liskov)', () => {
    for (let i = 1; i < cadeia.length; i++) {
      for (const acao of cadeia[i - 1].acoes()) expect(cadeia[i].pode(acao)).toBe(true);
    }
  });

  it('matriz de permissões', () => {
    expect(new Bloqueado().acoes()).toEqual([]);
    expect(new Visitante().acoes()).toEqual([Acao.VER]);
    expect(new Espectador().acoes()).toEqual([Acao.VER, Acao.INSCREVER_PROPRIO_TIME]);
    const org = new OrganizadorConvidado();
    expect(org.pode(Acao.PREENCHER_SUMULA)).toBe(true);
    expect(org.pode(Acao.EDITAR_REGULAMENTO)).toBe(true);
    expect(org.pode(Acao.BANIR)).toBe(true);
    expect(org.pode(Acao.CONFIGURAR)).toBe(false);
    expect(org.pode(Acao.GERENCIAR_ORGANIZADORES)).toBe(false);
    expect(org.pode(Acao.EXCLUIR)).toBe(false);
    expect(new Criador().pode(Acao.GERENCIAR_ORGANIZADORES)).toBe(true);
    expect(new AdministradorGlobal().acoes()).toEqual(Object.values(Acao));
  });

  it('o instanceof acompanha a hierarquia', () => {
    expect(new Criador()).toBeInstanceOf(OrganizadorConvidado);
    expect(new OrganizadorConvidado()).toBeInstanceOf(Espectador);
    expect(new Bloqueado()).not.toBeInstanceOf(Visitante);
  });
});

describe('PoliticaDeAcesso', () => {
  const politica = new PoliticaDeAcesso();
  const criador = conta('Criador');
  const convidado = conta('Convidado');
  const torcedor = conta('Torcedor');
  const adm = conta('Adm', true);

  const campeonato = (visibilidade: 'PUBLICA' | 'PRIVADA' = 'PUBLICA') => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: criador.id, visibilidade });
    const link = c.gerarLinkDeConvite(criador.id);
    c.aceitarConvite(link, { id: convidado.id, email: convidado.email });
    return c;
  };

  it('descobre o papel de cada um', () => {
    const c = campeonato();
    expect(politica.papelDe(Ator.deUsuario(criador), c)).toBeInstanceOf(Criador);
    expect(politica.papelDe(Ator.deUsuario(convidado), c).tipo).toBe('ORGANIZADOR');
    expect(politica.papelDe(Ator.deUsuario(torcedor), c).tipo).toBe('ESPECTADOR');
    expect(politica.papelDe(Ator.visitante(), c).tipo).toBe('VISITANTE');
    expect(politica.papelDe(Ator.deUsuario(adm), c).tipo).toBe('ADMINISTRADOR');
  });

  it('campeonato privado: sem a chave é como se não existisse (404)', () => {
    const c = campeonato('PRIVADA');
    expect(politica.papelDe(Ator.visitante(), c).tipo).toBe('BLOQUEADO');
    expect(() => politica.exigir(Ator.deUsuario(torcedor), c, Acao.VER)).toThrow('Campeonato não encontrado');
    expect(politica.papelDe(Ator.visitante(), c, c.chaveDeAcesso.valor).tipo).toBe('VISITANTE');
    expect(politica.papelDe(Ator.visitante(), c, 'chave-errada-com-tamanho').tipo).toBe('BLOQUEADO');
    // organizadores e ADM não precisam do link
    expect(politica.papelDe(Ator.deUsuario(convidado), c).tipo).toBe('ORGANIZADOR');
    expect(politica.papelDe(Ator.deUsuario(adm), c).tipo).toBe('ADMINISTRADOR');
  });

  it('quem tem time inscrito continua vendo o privado sem o link', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: criador.id, visibilidade: 'PRIVADA', modoInscricao: 'LIVRE', regulamento: { minJogadores: 1 } });
    c.solicitarInscricao(torcedor.id, { nome: 'Time do Torcedor', jogadores: [{ nome: 'Fulano', numero: 1, documento: 'f1' }] });
    expect(politica.papelDe(Ator.deUsuario(torcedor), c).tipo).toBe('ESPECTADOR');
  });

  it('banido de ver fica bloqueado mesmo em campeonato público', () => {
    const c = campeonato();
    c.banir(torcedor.id, 'VISUALIZACAO', 'spam', criador.id);
    expect(politica.papelDe(Ator.deUsuario(torcedor), c).tipo).toBe('BLOQUEADO');
  });

  it('exigir: 403 com mensagem clara para quem vê mas não pode', () => {
    const c = campeonato();
    expect(() => politica.exigir(Ator.deUsuario(torcedor), c, Acao.PREENCHER_SUMULA)).toThrow('Só os organizadores');
    expect(() => politica.exigir(Ator.deUsuario(convidado), c, Acao.EXCLUIR)).toThrow('Só o criador');
    expect(politica.exigir(Ator.deUsuario(adm), c, Acao.EXCLUIR).tipo).toBe('ADMINISTRADOR');
  });

  it('listagem: privado só aparece para quem participa e para o ADM', () => {
    const c = campeonato('PRIVADA');
    expect(politica.apareceNaListagem(Ator.visitante(), c)).toBe(false);
    expect(politica.apareceNaListagem(Ator.deUsuario(torcedor), c)).toBe(false);
    expect(politica.apareceNaListagem(Ator.deUsuario(convidado), c)).toBe(true);
    expect(politica.apareceNaListagem(Ator.deUsuario(adm), c)).toBe(true);
    expect(politica.apareceNaListagem(Ator.visitante(), campeonato('PUBLICA'))).toBe(true);
  });
});

describe('Usuario e papel no site', () => {
  it('toda conta nasce padrão; só o promover vira ADM', () => {
    const u = conta('Ana');
    expect(u.papel.tipo).toBe('PADRAO');
    expect(u.papel.temAcessoGlobal()).toBe(false);
    u.promoverAAdministrador();
    expect(u.papel.temAcessoGlobal()).toBe(true);
    expect(Usuario.restaurar(u.snapshot()).papel.tipo).toBe('ADM');
  });
});
