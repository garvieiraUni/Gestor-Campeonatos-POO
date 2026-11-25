import 'dotenv/config';
import { UsuarioRepositoryPostgres } from './repositorios-postgres';
import { criarPool, migrar } from './conexao';

/**
 * npm run adm:promover -- email@exemplo.com
 * Transforma uma conta já cadastrada em ADM do site. Não existe rota HTTP para isso de propósito:
 * só quem tem acesso ao banco cria administradores.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Informe o e-mail: npm run adm:promover -- email@exemplo.com');
  const pool = criarPool();
  try {
    await migrar(pool);
    const usuarios = new UsuarioRepositoryPostgres(pool);
    const usuario = await usuarios.buscarPorEmail(email);
    if (!usuario) throw new Error(`Não há conta com o e-mail ${email}`);
    usuario.promoverAAdministrador();
    await usuarios.salvar(usuario);
    console.log(`${usuario.nome} (${email}) agora é ADM do site`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
