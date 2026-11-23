import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, PoolClient } from 'pg';

export function criarPool(url = process.env.DATABASE_URL): Pool {
  if (!url) throw new Error('Defina DATABASE_URL para usar PERSISTENCIA=postgres');
  return new Pool({ connectionString: url });
}

export async function emTransacao<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

/** Executa, em ordem, os arquivos .sql de /migracoes que ainda não rodaram. */
export async function migrar(pool: Pool): Promise<string[]> {
  await pool.query('CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())');
  const pasta = join(__dirname, 'migracoes');
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
  const aplicadas: string[] = [];
  for (const arquivo of arquivos) {
    const { rowCount } = await pool.query('SELECT 1 FROM migracoes WHERE nome = $1', [arquivo]);
    if (rowCount) continue;
    await emTransacao(pool, async (c) => {
      await c.query(readFileSync(join(pasta, arquivo), 'utf8'));
      await c.query('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
    });
    aplicadas.push(arquivo);
  }
  return aplicadas;
}
