import { Pool } from 'pg';
import { Campeonato, Usuario } from '../../src/domain';
import { criarPool, migrar } from '../../src/infra/persistence/postgres/conexao';
import { CampeonatoRepositoryPostgres, UsuarioRepositoryPostgres } from '../../src/infra/persistence/postgres/repositorios-postgres';
import { CampeonatoBuilder, jogarFaseInteira } from '../builders/campeonato.builder';

/**
 * Testa o repositório contra um PostgreSQL real.
 * Só roda se DATABASE_URL_TEST estiver definida (ex.: no docker-compose).
 *   DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/campeonatos_test npm run test:integracao
 */
const url = process.env.DATABASE_URL_TEST;
const descrever = url ? describe : describe.skip;

descrever('CampeonatoRepositoryPostgres (integração)', () => {
  let pool: Pool;
  let repo: CampeonatoRepositoryPostgres;
  let organizadorId: string;

  beforeAll(async () => {
    pool = criarPool(url);
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrar(pool);
    repo = new CampeonatoRepositoryPostgres(pool);
    const u = Usuario.criar('Org', 'org@teste.com', 'hash');
    await new UsuarioRepositoryPostgres(pool).salvar(u);
    organizadorId = u.id;
  });

  afterAll(() => pool.end());

  const novo = () => {
    const c = CampeonatoBuilder.umCampeonato()
      .comEquipes(8)
      .comRegulamento({ formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 2 })
      .build();
    // troca o organizador fictício do builder por um usuário que existe no banco
    return { ...c.snapshot(), organizadorId };
  };

  it('salva e recarrega o agregado inteiro sem perder nada', async () => {
    const c = Campeonato.restaurar(novo());
    c.iniciar();
    const p = c.faseAtual!.partidas[0];
    const jogadores = c.obterEquipe(p.mandanteId).jogadores;
    c.iniciarPartida(p.id);
    c.registrarEvento(p.id, { tipo: 'GOL', jogadorId: jogadores[4].id, minuto: 3 });
    c.registrarEvento(p.id, { tipo: 'CARTAO_AMARELO', jogadorId: jogadores[0].id, minuto: 10 });
    c.registrarEvento(p.id, { tipo: 'CARTAO_AMARELO', jogadorId: jogadores[0].id, minuto: 20 }); // vira vermelho
    c.finalizarPartida(p.id);
    await repo.salvar(c);

    const carregado = await repo.buscarPorId(c.id);
    expect(carregado!.snapshot()).toEqual(c.snapshot());
    expect(carregado!.suspensoes).toHaveLength(1);
  });

  it('salvar de novo atualiza (até o campeonato encerrar)', async () => {
    const c = Campeonato.restaurar(novo());
    c.iniciar();
    await repo.salvar(c);
    while (c.status === 'EM_ANDAMENTO') {
      jogarFaseInteira(c);
      await repo.salvar(c);
    }
    const carregado = await repo.buscarPorId(c.id);
    expect(carregado!.status).toBe('ENCERRADO');
    expect(carregado!.campeaoId).toBe(c.campeaoId);
    expect(carregado!.fases.map((f) => f.nome)).toEqual(['Fase de grupos', 'Semifinal', 'Final']);
    expect((await repo.listar()).length).toBeGreaterThanOrEqual(2);
  });

  it('o banco também garante a R2 (documento único por campeonato)', async () => {
    const s = novo();
    s.equipes[1].jogadores[0].documento = s.equipes[0].jogadores[0].documento;
    await expect(repo.salvar(Campeonato.restaurar(s))).rejects.toThrow(/duplicate key/);
  });
});
