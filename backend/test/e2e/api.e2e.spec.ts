import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/main';

interface PartidaJson {
  id: string;
  status: string;
  mandante: { id: string };
  visitante: { id: string };
  suspensos: string[];
}
interface EquipeJson {
  id: string;
  jogadores: { id: string }[];
}

/**
 * Testes de ponta a ponta: sobem a API inteira (com repositórios em memória)
 * e fazem requisições HTTP de verdade.
 */
describe('API (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule.configurar({ persistencia: 'memoria', jwtSecret: 'teste', semearDemo: false })],
    }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());

    const r = await http.post('/api/auth/registrar').send({ nome: 'Ana', email: 'ana@teste.com', senha: '123456' });
    expect(r.status).toBe(201);
    token = r.body.token;
  });

  afterAll(() => app.close());

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function criarCampeonatoPronto(equipes = 2) {
    let r = await http
      .post('/api/campeonatos')
      .set(auth())
      .send({ nome: 'Copa E2E', regulamento: { minJogadores: 2, maxJogadores: 5 } });
    expect(r.status).toBe(201);
    const id: string = r.body.id;
    for (let i = 0; i < equipes; i++) {
      r = await http.post(`/api/campeonatos/${id}/equipes`).set(auth()).send({ nome: `Time ${i}` });
      const equipeId = r.body.equipes[i].id;
      for (let j = 1; j <= 2; j++) {
        r = await http
          .post(`/api/campeonatos/${id}/equipes/${equipeId}/jogadores`)
          .set(auth())
          .send({ nome: `Jogador ${i}${j}`, numero: j, documento: `d${i}${j}` });
        expect(r.status).toBe(201);
      }
    }
    r = await http.post(`/api/campeonatos/${id}/iniciar`).set(auth());
    expect(r.status).toBe(200);
    return r.body;
  }

  it('login com senha errada devolve 401', async () => {
    const r = await http.post('/api/auth/login').send({ email: 'ana@teste.com', senha: 'errada' });
    expect(r.status).toBe(401);
    expect(r.body.mensagem).toBe('E-mail ou senha incorretos');
  });

  it('login correto devolve token', async () => {
    const r = await http.post('/api/auth/login').send({ email: 'ANA@teste.com', senha: '123456' });
    expect(r.status).toBe(200);
    expect(r.body.token).toEqual(expect.any(String));
  });

  it('e-mail repetido no cadastro devolve 422', async () => {
    const r = await http.post('/api/auth/registrar').send({ nome: 'Ana 2', email: 'ana@teste.com', senha: '123456' });
    expect(r.status).toBe(422);
  });

  it('criar campeonato exige login', async () => {
    const r = await http.post('/api/campeonatos').send({ nome: 'Sem login' });
    expect(r.status).toBe(401);
  });

  it('valida a entrada com os DTOs (400)', async () => {
    const r = await http.post('/api/campeonatos').set(auth()).send({ nome: 'X' });
    expect(r.status).toBe(400);
  });

  it('regra de negócio violada devolve 422 com mensagem clara', async () => {
    const r = await http
      .post('/api/campeonatos')
      .set(auth())
      .send({ nome: 'Copa ruim', regulamento: { criteriosDesempate: ['SALDO_DE_GOLS'] } });
    expect(r.status).toBe(422);
    expect(r.body.mensagem).toContain('PONTOS');
  });

  it('fluxo completo: inscrever, iniciar, registrar gol, finalizar e ver a tabela', async () => {
    const c = await criarCampeonatoPronto();
    const partida: PartidaJson = c.fases[0].partidas[0];
    const artilheiro = (c.equipes as EquipeJson[]).find((e) => e.id === partida.mandante.id)!.jogadores[0];
    const base = `/api/campeonatos/${c.id}/partidas/${partida.id}`;

    expect((await http.post(`${base}/iniciar`).set(auth())).status).toBe(200);
    const gol = await http.post(`${base}/eventos`).set(auth()).send({ tipo: 'GOL', jogadorId: artilheiro.id, minuto: 12 });
    expect(gol.status).toBe(201);
    const fim = await http.post(`${base}/finalizar`).set(auth()).send({});
    expect(fim.status).toBe(200);
    expect(fim.body.status).toBe('ENCERRADO');
    expect(fim.body.campeao.id).toBe(partida.mandante.id);

    const tabela = await http.get(`/api/campeonatos/${c.id}/classificacao`);
    expect(tabela.body[0].linhas[0]).toMatchObject({ equipeId: partida.mandante.id, pontos: 3, golsPro: 1 });

    const artilharia = await http.get(`/api/campeonatos/${c.id}/artilharia`);
    expect(artilharia.body[0]).toMatchObject({ jogadorId: artilheiro.id, gols: 1 });
  });

  it('jogador suspenso não pode atuar: 422', async () => {
    const c = await criarCampeonatoPronto(3); // 3 equipes → cada uma joga 2 vezes
    const p1: PartidaJson = c.fases[0].partidas[0];
    const jogador = (c.equipes as EquipeJson[]).find((e) => e.id === p1.mandante.id)!.jogadores[0];
    const base = (pid: string) => `/api/campeonatos/${c.id}/partidas/${pid}`;

    await http.post(`${base(p1.id)}/iniciar`).set(auth());
    await http.post(`${base(p1.id)}/eventos`).set(auth()).send({ tipo: 'CARTAO_VERMELHO', jogadorId: jogador.id, minuto: 5 });
    const depois = await http.post(`${base(p1.id)}/finalizar`).set(auth()).send({});
    expect(depois.body.suspensoes).toHaveLength(1);

    const proxima = (depois.body.fases[0].partidas as PartidaJson[]).find(
      (p) => p.status === 'AGENDADA' && [p.mandante.id, p.visitante.id].includes(p1.mandante.id),
    )!;
    expect(proxima.suspensos).toContain(jogador.id);
    await http.post(`${base(proxima.id)}/iniciar`).set(auth());
    const r = await http.post(`${base(proxima.id)}/eventos`).set(auth()).send({ tipo: 'GOL', jogadorId: jogador.id, minuto: 3 });
    expect(r.status).toBe(422);
    expect(r.body.mensagem).toBe('Jogador cumpre suspensão nesta partida');
  });

  it('só o organizador altera o campeonato: 403', async () => {
    const c = await criarCampeonatoPronto();
    const outro = await http.post('/api/auth/registrar').send({ nome: 'Beto', email: 'beto@teste.com', senha: '123456' });
    const r = await http
      .post(`/api/campeonatos/${c.id}/equipes`)
      .set({ Authorization: `Bearer ${outro.body.token}` })
      .send({ nome: 'Invasores' });
    expect(r.status).toBe(403);
  });

  it('visitante consulta sem login; id inexistente devolve 404', async () => {
    expect((await http.get('/api/campeonatos')).status).toBe(200);
    const r = await http.get('/api/campeonatos/4f0e3c1a-1b2c-4d5e-8f90-123456789abc');
    expect(r.status).toBe(404);
  });
});
