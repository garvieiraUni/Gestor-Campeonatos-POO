import { AcessoNegadoError, Campeonato, ConflitoDeVersaoError, ConviteFactory, ConvitePorEmail, ConvitePorLink } from '../../../src/domain';
import { CampeonatoRepositoryEmMemoria } from '../../../src/infra/persistence/memoria/repositorios-memoria';

const ana = { id: 'ana', email: 'ana@teste.com' };
const beto = { id: 'beto', email: 'beto@teste.com' };

describe('Convites (classe abstrata + polimorfismo)', () => {
  it('a factory cria a subclasse certa', () => {
    expect(ConviteFactory.porEmail('ANA@teste.com', 'c')).toBeInstanceOf(ConvitePorEmail);
    expect(ConviteFactory.porLink('c')).toBeInstanceOf(ConvitePorLink);
    const link = ConviteFactory.porLink('c');
    expect(ConviteFactory.restaurar(link.snapshot())).toBeInstanceOf(ConvitePorLink);
  });

  it('por e-mail: só a conta convidada aceita, e uma vez só', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    const convite = c.convidarPorEmail(ana, 'criador');
    expect(() => c.aceitarConvite(convite, beto)).toThrow(AcessoNegadoError);
    c.aceitarConvite(convite, ana);
    expect(c.ehOrganizadorConvidado('ana')).toBe(true);
    expect(convite.status).toBe('ACEITO');
    expect(() => c.aceitarConvite(convite, ana)).toThrow();
  });

  it('por e-mail: pode ser recusado; não repete convite pendente', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    const convite = c.convidarPorEmail(ana, 'criador');
    expect(() => c.convidarPorEmail(ana, 'criador')).toThrow('pendente');
    c.recusarConvite(convite.id, ana);
    expect(convite.status).toBe('RECUSADO');
    expect(c.convitesAtivos).toHaveLength(0);
  });

  it('por link: várias contas usam o mesmo link até ele ser revogado', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    const link = c.gerarLinkDeConvite('criador');
    c.aceitarConvite(link, ana);
    c.aceitarConvite(link, beto);
    expect(c.organizadores).toEqual(['ana', 'beto']);
    c.revogarConvite(link.id);
    expect(() => c.aceitarConvite(link, { id: 'caio', email: 'caio@teste.com' })).toThrow('não está mais válido');
    expect(() => c.recusarConvite(link.id, ana)).toThrow();
  });

  it('não convida quem já organiza; aceitar tira um banimento antigo', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    expect(() => c.convidarPorEmail({ id: 'criador', email: 'c@teste.com' }, 'criador')).toThrow('já faz parte');
    c.banir('ana', 'VISUALIZACAO', '', 'criador');
    c.aceitarConvite(c.gerarLinkDeConvite('criador'), ana);
    expect(c.estaBanidoDeVer('ana')).toBe(false);
  });

  it('R23: criador remove convidados, mas ninguém remove nem tira o criador', () => {
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    c.aceitarConvite(c.gerarLinkDeConvite('criador'), ana);
    c.aceitarConvite(c.gerarLinkDeConvite('criador'), beto);
    c.removerOrganizador('ana');
    expect(c.organizadores).toEqual(['beto']);
    c.sairDaOrganizacao('beto');
    expect(c.organizadores).toEqual([]);
    expect(() => c.removerOrganizador('criador')).toThrow('criador');
    expect(() => c.sairDaOrganizacao('criador')).toThrow('criador');
  });
});

describe('Lock otimista (versão)', () => {
  it('a segunda gravação feita a partir da mesma versão é recusada', async () => {
    const repo = new CampeonatoRepositoryEmMemoria();
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    expect(c.versao).toBe(0);
    await repo.salvar(c);
    expect(c.versao).toBe(1);

    const aba1 = (await repo.buscarPorId(c.id))!;
    const aba2 = (await repo.buscarPorId(c.id))!;
    aba1.inscreverEquipe('Leões');
    aba2.inscreverEquipe('Tigres');
    await repo.salvar(aba1);
    await expect(repo.salvar(aba2)).rejects.toThrow(ConflitoDeVersaoError);

    const final = (await repo.buscarPorId(c.id))!;
    expect(final.equipes.map((e) => e.nome)).toEqual(['Leões']);
    expect(final.versao).toBe(2);
  });

  it('criar duas vezes o mesmo campeonato também conflita', async () => {
    const repo = new CampeonatoRepositoryEmMemoria();
    const c = Campeonato.criar({ nome: 'Copa', criadorId: 'criador' });
    const copia = Campeonato.restaurar(c.snapshot());
    await repo.salvar(c);
    await expect(repo.salvar(copia)).rejects.toThrow(ConflitoDeVersaoError);
  });
});
