import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../src/domain';
import { configurarApp } from '../../src/main';

/**
 * Fluxos com várias contas: criador, organizador convidado, espectador, ADM e visitante.
 */
describe('Papéis, convites, visibilidade e inscrições (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const as = (quem: string) => ({ Authorization: `Bearer ${tokens[quem]}` });
  const elenco = (prefixo: string, n = 2) =>
    Array.from({ length: n }, (_, i) => ({ nome: `${prefixo} ${i + 1}`, numero: i + 1, documento: `${prefixo}-${i}` }));

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule.configurar({ persistencia: 'memoria', jwtSecret: 'teste', semearDemo: false })],
    }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());

    for (const nome of ['criador', 'convidado', 'torcedor', 'adm', 'intruso']) {
      const r = await http.post('/api/auth/registrar').send({ nome, email: `${nome}@teste.com`, senha: '123456' });
      tokens[nome] = r.body.token;
      ids[nome] = r.body.usuario.id;
    }
    // ADM não nasce pelo cadastro: promovemos direto no repositório (como faz o script adm:promover)
    const usuarios = app.get<UsuarioRepository>(USUARIO_REPOSITORY);
    const adm = (await usuarios.buscarPorId(ids.adm))!;
    adm.promoverAAdministrador();
    await usuarios.salvar(adm);
  });

  afterAll(() => app.close());

  async function criar(corpo: Record<string, unknown> = {}) {
    const r = await http
      .post('/api/campeonatos')
      .set(as('criador'))
      .send({ nome: 'Copa Multi', regulamento: { minJogadores: 2, maxJogadores: 4 }, ...corpo });
    expect(r.status).toBe(201);
    return r.body;
  }

  it('o cadastro devolve o papel padrão; /auth/eu reflete a promoção a ADM', async () => {
    const r = await http.get('/api/auth/eu').set(as('adm'));
    expect(r.body.papel).toBe('ADM');
    const login = await http.post('/api/auth/login').send({ email: 'torcedor@teste.com', senha: '123456' });
    expect(login.body.usuario.papel).toBe('PADRAO');
  });

  it('cada um recebe o seu papel e as suas permissões', async () => {
    const c = await criar();
    const ver = async (quem?: string) => {
      const r = http.get(`/api/campeonatos/${c.id}`);
      return (await (quem ? r.set(as(quem)) : r)).body;
    };
    expect((await ver('criador')).meuPapel).toBe('CRIADOR');
    expect((await ver('torcedor')).meuPapel).toBe('ESPECTADOR');
    expect((await ver()).meuPapel).toBe('VISITANTE');
    expect((await ver('adm')).permissoes).toContain('EXCLUIR');
    expect((await ver('torcedor')).permissoes).toEqual(['VER', 'INSCREVER_PROPRIO_TIME']);
  });

  it('convite por e-mail: aparece em "meus convites", é aceito e o convidado preenche a súmula', async () => {
    const c = await criar();
    expect((await http.post(`/api/campeonatos/${c.id}/convites`).set(as('convidado')).send({ email: 'x@teste.com' })).status).toBe(403);
    const semConta = await http.post(`/api/campeonatos/${c.id}/convites`).set(as('criador')).send({ email: 'ninguem@teste.com' });
    expect(semConta.status).toBe(404);

    await http.post(`/api/campeonatos/${c.id}/convites`).set(as('criador')).send({ email: 'convidado@teste.com' });
    const meus = await http.get('/api/convites').set(as('convidado'));
    const convite = meus.body.find((x: { campeonatoId: string }) => x.campeonatoId === c.id);
    expect(convite).toBeDefined();

    // outra conta não consegue aceitar um convite que não é dela
    const roubo = await http.post(`/api/campeonatos/${c.id}/convites/${convite.conviteId}/aceitar`).set(as('intruso'));
    expect(roubo.status).toBe(403);

    const aceito = await http.post(`/api/campeonatos/${c.id}/convites/${convite.conviteId}/aceitar`).set(as('convidado'));
    expect(aceito.status).toBe(200);
    expect(aceito.body.meuPapel).toBe('ORGANIZADOR');

    // convidado inscreve times e monta o campeonato
    for (const t of ['A', 'B']) {
      let r = await http.post(`/api/campeonatos/${c.id}/equipes`).set(as('convidado')).send({ nome: `Time ${t}` });
      const equipe = r.body.equipes.find((e: { nome: string }) => e.nome === `Time ${t}`);
      for (const j of elenco(t)) {
        r = await http.post(`/api/campeonatos/${c.id}/equipes/${equipe.id}/jogadores`).set(as('convidado')).send(j);
        expect(r.status).toBe(201);
      }
    }
    const iniciado = await http.post(`/api/campeonatos/${c.id}/iniciar`).set(as('convidado'));
    expect(iniciado.status).toBe(200);
    const partida = iniciado.body.fases[0].partidas[0];
    expect((await http.post(`/api/campeonatos/${c.id}/partidas/${partida.id}/iniciar`).set(as('convidado'))).status).toBe(200);

    // mas não mexe na essência do campeonato nem nos outros organizadores
    expect((await http.patch(`/api/campeonatos/${c.id}`).set(as('convidado')).send({ nome: 'Copa Tomada' })).status).toBe(403);
    expect((await http.delete(`/api/campeonatos/${c.id}`).set(as('convidado'))).status).toBe(403);
    expect((await http.delete(`/api/campeonatos/${c.id}/organizadores/${ids.criador}`).set(as('convidado'))).status).toBe(403);
  });

  it('convite por link: vale para várias contas e pode ser revogado', async () => {
    const c = await criar();
    const r = await http.post(`/api/campeonatos/${c.id}/convites/link`).set(as('criador'));
    const link = r.body.convites.find((x: { tipo: string }) => x.tipo === 'LINK');
    const previa = await http.get(`/api/convites/link/${link.token}`).set(as('torcedor'));
    expect(previa.body).toMatchObject({ campeonato: 'Copa Multi', ativo: true, jaOrganiza: false });

    expect((await http.post(`/api/convites/link/${link.token}/aceitar`).set(as('torcedor'))).body.meuPapel).toBe('ORGANIZADOR');
    await http.delete(`/api/campeonatos/${c.id}/convites/${link.id}`).set(as('criador'));
    expect((await http.post(`/api/convites/link/${link.token}/aceitar`).set(as('intruso'))).status).toBe(422);

    // o criador remove o organizador; ele volta a ser espectador
    const removido = await http.delete(`/api/campeonatos/${c.id}/organizadores/${ids.torcedor}`).set(as('criador'));
    expect(removido.body.organizadores).toEqual([]);
  });

  it('privado: 404 sem a chave, 200 com ela; não aparece na lista pública', async () => {
    const c = await criar({ visibilidade: 'PRIVADA' });
    expect((await http.get(`/api/campeonatos/${c.id}`).set(as('torcedor'))).status).toBe(404);
    expect((await http.get(`/api/campeonatos/${c.id}`)).status).toBe(404);
    const comChave = await http.get(`/api/campeonatos/${c.id}`).set('X-Chave-Acesso', c.chaveDeAcesso);
    expect(comChave.status).toBe(200);
    expect(comChave.body.chaveDeAcesso).toBeNull(); // visitante não recebe a chave

    const lista = await http.get('/api/campeonatos');
    expect(lista.body.some((x: { id: string }) => x.id === c.id)).toBe(false);
    const listaDoCriador = await http.get('/api/campeonatos').set(as('criador'));
    expect(listaDoCriador.body.some((x: { id: string }) => x.id === c.id)).toBe(true);
    const listaDoAdm = await http.get('/api/campeonatos').set(as('adm'));
    expect(listaDoAdm.body.some((x: { id: string }) => x.id === c.id)).toBe(true);

    // regenerar a chave derruba o link antigo
    await http.post(`/api/campeonatos/${c.id}/chave-de-acesso`).set(as('criador'));
    expect((await http.get(`/api/campeonatos/${c.id}`).set('X-Chave-Acesso', c.chaveDeAcesso)).status).toBe(404);
  });

  it('inscrição com aprovação: recusa com motivo, reenvio e aprovação; aviso de privado', async () => {
    const c = await criar({ modoInscricao: 'COM_APROVACAO' });
    const url = `/api/campeonatos/${c.id}`;
    expect((await http.post(`${url}/inscricao`).send({ nome: 'Sem login', jogadores: elenco('S') })).status).toBe(401);

    let r = await http.post(`${url}/inscricao`).set(as('torcedor')).send({ nome: 'Torcida FC', jogadores: elenco('T') });
    expect(r.status).toBe(201);
    const minha = r.body.equipes.find((e: { id: string }) => e.id === r.body.minhaEquipeId);
    expect(minha.status).toBe('PENDENTE');

    // outro espectador não vê o time pendente, nem os documentos
    const outro = await http.get(url).set(as('intruso'));
    expect(outro.body.equipes).toHaveLength(0);

    r = await http.post(`${url}/equipes/${minha.id}/recusar`).set(as('criador')).send({ motivo: 'Faltou o goleiro' });
    expect(r.status).toBe(200);
    const vistaDoTorcedor = await http.get(url).set(as('torcedor'));
    expect(vistaDoTorcedor.body.equipes[0]).toMatchObject({ status: 'RECUSADA', motivoRecusa: 'Faltou o goleiro' });

    r = await http.post(`${url}/inscricao/reenviar`).set(as('torcedor')).send({ nome: 'Torcida FC', jogadores: elenco('G', 3) });
    expect(r.status).toBe(200);
    r = await http.post(`${url}/equipes/${minha.id}/aprovar`).set(as('criador'));
    expect(r.body.equipes[0].status).toBe('APROVADA');
    expect(r.body.quantidadeDeEquipes).toBe(1);

    // edição do elenco depois do envio é só dos organizadores
    const jogador = r.body.equipes[0].jogadores[0];
    expect((await http.delete(`${url}/equipes/${minha.id}/jogadores/${jogador.id}`).set(as('torcedor'))).status).toBe(403);
    expect((await http.delete(`${url}/equipes/${minha.id}/jogadores/${jogador.id}`).set(as('criador'))).status).toBe(200);

    r = await http.patch(url).set(as('criador')).send({ visibilidade: 'PRIVADA' });
    expect(r.body.avisos[0]).toContain('privado');
  });

  it('inscrição fechada recusa espectador (422); livre aceita na hora', async () => {
    const fechada = await criar();
    const r = await http.post(`/api/campeonatos/${fechada.id}/inscricao`).set(as('torcedor')).send({ nome: 'Time', jogadores: elenco('F') });
    expect(r.status).toBe(422);

    const livre = await criar({ modoInscricao: 'LIVRE' });
    const ok = await http.post(`/api/campeonatos/${livre.id}/inscricao`).set(as('torcedor')).send({ nome: 'Time', jogadores: elenco('L') });
    expect(ok.body.equipes[0].status).toBe('APROVADA');
  });

  it('banimento: impede inscrever e, no nível VISUALIZACAO, de ver', async () => {
    const c = await criar({ modoInscricao: 'LIVRE' });
    const url = `/api/campeonatos/${c.id}`;
    await http.post(`${url}/banimentos`).set(as('criador')).send({ usuarioId: ids.intruso, nivel: 'INSCRICAO', motivo: 'spam' });
    let r = await http.post(`${url}/inscricao`).set(as('intruso')).send({ nome: 'Spam FC', jogadores: elenco('X') });
    expect(r.status).toBe(422);
    expect(r.body.mensagem).toContain('impedida');

    await http.post(`${url}/banimentos`).set(as('criador')).send({ usuarioId: ids.intruso, nivel: 'VISUALIZACAO' });
    expect((await http.get(url).set(as('intruso'))).status).toBe(404);

    r = await http.delete(`${url}/banimentos/${ids.intruso}`).set(as('criador'));
    expect(r.body.banimentos).toEqual([]);
    expect((await http.get(url).set(as('intruso'))).status).toBe(200);
  });

  it('regulamento: organizadores alteram antes do início; depois trava (422)', async () => {
    const c = await criar();
    const url = `/api/campeonatos/${c.id}`;
    expect((await http.patch(`${url}/regulamento`).set(as('torcedor')).send({ pontosVitoria: 2 })).status).toBe(403);
    const r = await http.patch(`${url}/regulamento`).set(as('criador')).send({ pontosVitoria: 2 });
    expect(r.body.regulamento.pontosVitoria).toBe(2);

    for (const t of ['A', 'B']) {
      const e = await http.post(`${url}/equipes`).set(as('criador')).send({ nome: `Time ${t}` });
      const equipe = e.body.equipes.find((x: { nome: string }) => x.nome === `Time ${t}`);
      for (const j of elenco(t)) await http.post(`${url}/equipes/${equipe.id}/jogadores`).set(as('criador')).send(j);
    }
    await http.post(`${url}/iniciar`).set(as('criador'));
    expect((await http.patch(`${url}/regulamento`).set(as('criador')).send({ pontosVitoria: 4 })).status).toBe(422);
  });

  it('ADM altera e exclui o campeonato de outra pessoa', async () => {
    const c = await criar();
    const r = await http.patch(`/api/campeonatos/${c.id}`).set(as('adm')).send({ nome: 'Copa Corrigida' });
    expect(r.body.nome).toBe('Copa Corrigida');
    expect(r.body.meuPapel).toBe('ADMINISTRADOR');
    expect((await http.delete(`/api/campeonatos/${c.id}`).set(as('adm'))).status).toBe(204);
    expect((await http.get(`/api/campeonatos/${c.id}`)).status).toBe(404);
  });

  it('documentos dos jogadores só aparecem para a organização', async () => {
    const c = await criar();
    const url = `/api/campeonatos/${c.id}`;
    const e = await http.post(`${url}/equipes`).set(as('criador')).send({ nome: 'Time Doc' });
    await http.post(`${url}/equipes/${e.body.equipes[0].id}/jogadores`).set(as('criador')).send({ nome: 'Fulano', numero: 1, documento: 'CPF-123' });
    expect((await http.get(url)).body.equipes[0].jogadores[0].documento).toBeNull();
    expect((await http.get(url).set(as('criador'))).body.equipes[0].jogadores[0].documento).toBe('CPF-123');
  });
});
