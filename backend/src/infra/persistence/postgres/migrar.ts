import 'dotenv/config';
import { criarPool, migrar } from './conexao';

/** npm run db:migrate */
async function main() {
  const pool = criarPool();
  const aplicadas = await migrar(pool);
  console.log(aplicadas.length ? `Migrações aplicadas: ${aplicadas.join(', ')}` : 'Banco já está atualizado');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
