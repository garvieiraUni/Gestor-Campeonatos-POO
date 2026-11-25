import { Pool, PoolClient } from 'pg';
import {
  Campeonato,
  CampeonatoRepository,
  CampeonatoSnapshot,
  ConflitoDeVersaoError,
  EventoSnapshot,
  FaseSnapshot,
  Id,
  PartidaSnapshot,
  Usuario,
  UsuarioRepository,
} from '../../../domain';
import { emTransacao } from './conexao';

const MENSAGEM_CONFLITO = 'Outra pessoa alterou este campeonato ao mesmo tempo. Recarregue a página e tente de novo.';

/** INSERT de várias linhas em um único comando (em blocos, para não estourar o limite de parâmetros). */
async function inserirVarios(c: PoolClient, tabela: string, colunas: string[], linhas: unknown[][]): Promise<void> {
  const porBloco = Math.floor(10000 / colunas.length);
  for (let i = 0; i < linhas.length; i += porBloco) {
    const bloco = linhas.slice(i, i + porBloco);
    const valores: unknown[] = [];
    const tuplas = bloco.map((linha) => {
      const marcadores = linha.map((v) => {
        valores.push(v);
        return `$${valores.length}`;
      });
      return `(${marcadores.join(', ')})`;
    });
    await c.query(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES ${tuplas.join(', ')}`, valores);
  }
}

const ehViolacaoDeUnicidade = (e: unknown, restricao: string) =>
  typeof e === 'object' && e !== null && (e as { code?: string; constraint?: string }).code === '23505' &&
  (e as { constraint?: string }).constraint === restricao;

/**
 * Persiste o agregado Campeonato em tabelas relacionais.
 * Numa transação, grava a linha do campeonato (conferindo a versão: lock otimista)
 * e regrava os filhos (equipes, fases, partidas, eventos, suspensões, organização).
 */
export class CampeonatoRepositoryPostgres implements CampeonatoRepository {
  constructor(private readonly pool: Pool) {}

  async salvar(campeonato: Campeonato): Promise<void> {
    const s = campeonato.snapshot();
    const r = s.regulamento;
    await emTransacao(this.pool, async (c) => {
      const colunas = [
        s.nome, s.descricao, s.modalidade, s.status, s.campeaoId, r.formato,
        r.minJogadores, r.maxJogadores, r.pontosVitoria, r.pontosEmpate, r.pontosDerrota, r.criteriosDesempate,
        r.idaEVolta, r.numeroGrupos, r.amarelosParaSuspensao, r.jogosSuspensaoVermelho,
        s.visibilidade, s.modoInscricao, s.chaveAcesso,
      ];
      if (s.versao === 0) {
        try {
          await c.query(
            `INSERT INTO campeonatos (nome, descricao, modalidade, status, campeao_id, formato,
               min_jogadores, max_jogadores, pontos_vitoria, pontos_empate, pontos_derrota, criterios_desempate,
               ida_e_volta, numero_grupos, amarelos_para_suspensao, jogos_suspensao_vermelho,
               visibilidade, modo_inscricao, chave_acesso, id, criador_id, criado_em, versao)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,1)`,
            [...colunas, s.id, s.criadorId, s.criadoEm],
          );
        } catch (e) {
          if (ehViolacaoDeUnicidade(e, 'campeonatos_pkey')) throw new ConflitoDeVersaoError(MENSAGEM_CONFLITO);
          throw e;
        }
      } else {
        const { rowCount } = await c.query(
          `UPDATE campeonatos SET nome = $1, descricao = $2, modalidade = $3, status = $4, campeao_id = $5, formato = $6,
             min_jogadores = $7, max_jogadores = $8, pontos_vitoria = $9, pontos_empate = $10, pontos_derrota = $11,
             criterios_desempate = $12, ida_e_volta = $13, numero_grupos = $14, amarelos_para_suspensao = $15,
             jogos_suspensao_vermelho = $16, visibilidade = $17, modo_inscricao = $18, chave_acesso = $19,
             versao = versao + 1
           WHERE id = $20 AND versao = $21`,
          [...colunas, s.id, s.versao],
        );
        if (rowCount === 0) throw new ConflitoDeVersaoError(MENSAGEM_CONFLITO);
      }

      // apaga os filhos (as FKs com ON DELETE CASCADE levam partidas, eventos etc.)
      for (const tabela of ['suspensoes', 'fases', 'equipes', 'convites', 'banimentos', 'campeonato_organizadores']) {
        await c.query(`DELETE FROM ${tabela} WHERE campeonato_id = $1`, [s.id]);
      }

      await inserirVarios(
        c,
        'equipes',
        ['id', 'campeonato_id', 'nome', 'ordem', 'responsavel_id', 'status_inscricao', 'motivo_recusa'],
        s.equipes.map((e, i) => [e.id, s.id, e.nome, i, e.responsavelId, e.status, e.motivoRecusa]),
      );
      await inserirVarios(
        c,
        'jogadores',
        ['id', 'equipe_id', 'campeonato_id', 'nome', 'numero', 'documento', 'posicao', 'ordem'],
        s.equipes.flatMap((e) => e.jogadores.map((j, i) => [j.id, e.id, s.id, j.nome, j.numero, j.documento, j.posicao, i])),
      );
      await inserirVarios(c, 'fases', ['id', 'campeonato_id', 'nome', 'tipo', 'ordem'], s.fases.map((f) => [f.id, s.id, f.nome, f.tipo, f.ordem]));
      await inserirVarios(
        c,
        'grupo_equipes',
        ['fase_id', 'grupo', 'equipe_id', 'ordem'],
        s.fases.flatMap((f) => f.grupos.flatMap((g) => g.equipeIds.map((id, i) => [f.id, g.nome, id, i]))),
      );
      const partidas = s.fases.flatMap((f) => f.partidas.map((p) => ({ f, p })));
      await inserirVarios(
        c,
        'partidas',
        ['id', 'fase_id', 'rodada', 'grupo', 'posicao', 'mandante_id', 'visitante_id', 'eliminatoria', 'status', 'penaltis_mandante', 'penaltis_visitante'],
        partidas.map(({ f, p }) => [
          p.id, f.id, p.rodada, p.grupo, p.posicao, p.mandanteId, p.visitanteId, p.eliminatoria, p.status,
          p.penaltis?.mandante ?? null, p.penaltis?.visitante ?? null,
        ]),
      );
      await inserirVarios(
        c,
        'eventos_partida',
        ['id', 'partida_id', 'jogador_id', 'equipe_id', 'tipo', 'minuto', 'segundo_amarelo', 'ordem'],
        partidas.flatMap(({ p }) => p.eventos.map((e, i) => [e.id, p.id, e.jogadorId, e.equipeId, e.tipo, e.minuto, e.segundoAmarelo, i])),
      );
      await inserirVarios(
        c,
        'suspensoes',
        ['id', 'campeonato_id', 'jogador_id', 'equipe_id', 'motivo', 'partida_origem_id', 'jogos', 'ordem'],
        s.suspensoes.map((x, i) => [x.id, s.id, x.jogadorId, x.equipeId, x.motivo, x.partidaOrigemId, x.jogos, i]),
      );
      await inserirVarios(
        c,
        'suspensoes_cumpridas',
        ['suspensao_id', 'partida_id', 'ordem'],
        s.suspensoes.flatMap((x) => x.partidasCumpridas.map((pid, i) => [x.id, pid, i])),
      );
      await inserirVarios(
        c,
        'campeonato_organizadores',
        ['campeonato_id', 'usuario_id', 'ordem'],
        s.organizadores.map((u, i) => [s.id, u, i]),
      );
      await inserirVarios(
        c,
        'convites',
        ['id', 'campeonato_id', 'tipo', 'email', 'token', 'status', 'criado_por', 'criado_em', 'ordem'],
        s.convites.map((x, i) => [x.id, s.id, x.tipo, x.email, x.token, x.status, x.criadoPor, x.criadoEm, i]),
      );
      await inserirVarios(
        c,
        'convite_aceites',
        ['convite_id', 'usuario_id', 'ordem'],
        s.convites.flatMap((x) => x.aceitoPor.map((u, i) => [x.id, u, i])),
      );
      await inserirVarios(
        c,
        'banimentos',
        ['campeonato_id', 'usuario_id', 'nivel', 'motivo', 'banido_por', 'banido_em'],
        s.banimentos.map((b) => [s.id, b.usuarioId, b.nivel, b.motivo, b.banidoPor, b.banidoEm]),
      );
    });
    campeonato.registrarGravacao();
  }

  async buscarPorId(id: Id): Promise<Campeonato | null> {
    const { rows } = await this.pool.query('SELECT * FROM campeonatos WHERE id = $1', [id]);
    if (!rows.length) return null;
    const c = rows[0];
    const q = async (sql: string) => (await this.pool.query(sql, [id])).rows;

    const [equipes, jogadores, fases, grupos, partidas, eventos, suspensoes, cumpridas, organizadores, convites, aceites, banimentos] =
      await Promise.all([
        q('SELECT * FROM equipes WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT * FROM jogadores WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT * FROM fases WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT g.* FROM grupo_equipes g JOIN fases f ON f.id = g.fase_id WHERE f.campeonato_id = $1 ORDER BY g.grupo, g.ordem'),
        q('SELECT p.* FROM partidas p JOIN fases f ON f.id = p.fase_id WHERE f.campeonato_id = $1 ORDER BY p.grupo NULLS FIRST, p.posicao'),
        q('SELECT e.* FROM eventos_partida e JOIN partidas p ON p.id = e.partida_id JOIN fases f ON f.id = p.fase_id WHERE f.campeonato_id = $1 ORDER BY e.ordem'),
        q('SELECT * FROM suspensoes WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT sc.* FROM suspensoes_cumpridas sc JOIN suspensoes s ON s.id = sc.suspensao_id WHERE s.campeonato_id = $1 ORDER BY sc.ordem'),
        q('SELECT * FROM campeonato_organizadores WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT * FROM convites WHERE campeonato_id = $1 ORDER BY ordem'),
        q('SELECT a.* FROM convite_aceites a JOIN convites c ON c.id = a.convite_id WHERE c.campeonato_id = $1 ORDER BY a.ordem'),
        q('SELECT * FROM banimentos WHERE campeonato_id = $1 ORDER BY banido_em'),
      ]);

    const eventosDa = (partidaId: Id): EventoSnapshot[] =>
      eventos
        .filter((e) => e.partida_id === partidaId)
        .map((e) => ({ id: e.id, tipo: e.tipo, jogadorId: e.jogador_id, equipeId: e.equipe_id, minuto: e.minuto, segundoAmarelo: e.segundo_amarelo }));

    const partidasDa = (faseId: Id): PartidaSnapshot[] =>
      partidas
        .filter((p) => p.fase_id === faseId)
        .map((p) => ({
          id: p.id,
          rodada: p.rodada,
          grupo: p.grupo,
          posicao: p.posicao,
          mandanteId: p.mandante_id,
          visitanteId: p.visitante_id,
          eliminatoria: p.eliminatoria,
          status: p.status,
          eventos: eventosDa(p.id),
          penaltis: p.penaltis_mandante === null ? null : { mandante: p.penaltis_mandante, visitante: p.penaltis_visitante },
        }));

    const fasesSnap: FaseSnapshot[] = fases.map((f) => {
      const nomes = [...new Set(grupos.filter((g) => g.fase_id === f.id).map((g) => g.grupo as string))];
      return {
        id: f.id,
        nome: f.nome,
        tipo: f.tipo,
        ordem: f.ordem,
        grupos: nomes.map((nome) => ({
          nome,
          equipeIds: grupos.filter((g) => g.fase_id === f.id && g.grupo === nome).map((g) => g.equipe_id),
        })),
        partidas: partidasDa(f.id),
      };
    });

    const snapshot: CampeonatoSnapshot = {
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      modalidade: c.modalidade,
      criadorId: c.criador_id,
      organizadores: organizadores.map((o) => o.usuario_id),
      status: c.status,
      visibilidade: c.visibilidade,
      modoInscricao: c.modo_inscricao,
      chaveAcesso: c.chave_acesso,
      campeaoId: c.campeao_id,
      criadoEm: new Date(c.criado_em).toISOString(),
      versao: c.versao,
      regulamento: {
        formato: c.formato,
        minJogadores: c.min_jogadores,
        maxJogadores: c.max_jogadores,
        pontosVitoria: c.pontos_vitoria,
        pontosEmpate: c.pontos_empate,
        pontosDerrota: c.pontos_derrota,
        criteriosDesempate: c.criterios_desempate,
        idaEVolta: c.ida_e_volta,
        numeroGrupos: c.numero_grupos,
        amarelosParaSuspensao: c.amarelos_para_suspensao,
        jogosSuspensaoVermelho: c.jogos_suspensao_vermelho,
      },
      equipes: equipes.map((e) => ({
        id: e.id,
        nome: e.nome,
        responsavelId: e.responsavel_id,
        status: e.status_inscricao,
        motivoRecusa: e.motivo_recusa,
        jogadores: jogadores
          .filter((j) => j.equipe_id === e.id)
          .map((j) => ({ id: j.id, nome: j.nome, numero: j.numero, documento: j.documento, posicao: j.posicao })),
      })),
      fases: fasesSnap,
      suspensoes: suspensoes.map((x) => ({
        id: x.id,
        jogadorId: x.jogador_id,
        equipeId: x.equipe_id,
        motivo: x.motivo,
        partidaOrigemId: x.partida_origem_id,
        jogos: x.jogos,
        partidasCumpridas: cumpridas.filter((k) => k.suspensao_id === x.id).map((k) => k.partida_id),
      })),
      convites: convites.map((x) => ({
        id: x.id,
        tipo: x.tipo,
        email: x.email,
        token: x.token,
        status: x.status,
        criadoPor: x.criado_por,
        criadoEm: new Date(x.criado_em).toISOString(),
        aceitoPor: aceites.filter((a) => a.convite_id === x.id).map((a) => a.usuario_id),
      })),
      banimentos: banimentos.map((b) => ({
        usuarioId: b.usuario_id,
        nivel: b.nivel,
        motivo: b.motivo,
        banidoPor: b.banido_por,
        banidoEm: new Date(b.banido_em).toISOString(),
      })),
    };
    return Campeonato.restaurar(snapshot);
  }

  async listar(): Promise<Campeonato[]> {
    const { rows } = await this.pool.query('SELECT id FROM campeonatos ORDER BY criado_em DESC');
    return this.carregarVarios(rows.map((r) => r.id));
  }

  async excluir(id: Id): Promise<void> {
    await this.pool.query('DELETE FROM campeonatos WHERE id = $1', [id]);
  }

  async buscarPorTokenDeConvite(token: string): Promise<Campeonato | null> {
    const { rows } = await this.pool.query("SELECT campeonato_id FROM convites WHERE tipo = 'LINK' AND token = $1", [token]);
    return rows.length ? this.buscarPorId(rows[0].campeonato_id) : null;
  }

  async listarComConvitePara(email: string): Promise<Campeonato[]> {
    const { rows } = await this.pool.query(
      "SELECT DISTINCT campeonato_id FROM convites WHERE tipo = 'EMAIL' AND status = 'PENDENTE' AND email = $1",
      [email.toLowerCase()],
    );
    return this.carregarVarios(rows.map((r) => r.campeonato_id));
  }

  private async carregarVarios(ids: Id[]): Promise<Campeonato[]> {
    const todos = await Promise.all(ids.map((id) => this.buscarPorId(id)));
    return todos.filter((c): c is Campeonato => c !== null);
  }
}

type LinhaUsuario = { id: string; nome: string; email: string; senha_hash: string; papel: 'ADM' | 'PADRAO'; criado_em: Date };

export class UsuarioRepositoryPostgres implements UsuarioRepository {
  constructor(private readonly pool: Pool) {}

  async salvar(u: Usuario): Promise<void> {
    const s = u.snapshot();
    await this.pool.query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, papel, criado_em) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email, senha_hash = EXCLUDED.senha_hash, papel = EXCLUDED.papel`,
      [s.id, s.nome, s.email, s.senhaHash, s.papel, s.criadoEm],
    );
  }

  async buscarPorId(id: Id): Promise<Usuario | null> {
    const { rows } = await this.pool.query<LinhaUsuario>('SELECT * FROM usuarios WHERE id = $1', [id]);
    return rows.length ? this.paraUsuario(rows[0]) : null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const { rows } = await this.pool.query<LinhaUsuario>('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]);
    return rows.length ? this.paraUsuario(rows[0]) : null;
  }

  async buscarVarios(ids: readonly Id[]): Promise<Usuario[]> {
    if (!ids.length) return [];
    const { rows } = await this.pool.query<LinhaUsuario>('SELECT * FROM usuarios WHERE id = ANY($1::uuid[])', [ids]);
    return rows.map((r) => this.paraUsuario(r));
  }

  private paraUsuario(r: LinhaUsuario): Usuario {
    return Usuario.restaurar({
      id: r.id,
      nome: r.nome,
      email: r.email,
      senhaHash: r.senha_hash,
      papel: r.papel,
      criadoEm: new Date(r.criado_em).toISOString(),
    });
  }
}
