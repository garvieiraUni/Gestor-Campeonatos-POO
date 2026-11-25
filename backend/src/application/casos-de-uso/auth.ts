import { CredenciaisInvalidasError, RegraDeNegocioError, TipoPapelNoSite, Usuario, UsuarioRepository } from '../../domain';
import { GeradorDeHash, GeradorDeToken } from '../portas/portas';

export interface SessaoDto {
  token: string;
  usuario: { id: string; nome: string; email: string; papel: TipoPapelNoSite };
}

const sessao = (u: Usuario, tokens: GeradorDeToken): SessaoDto => {
  const usuario = { id: u.id, nome: u.nome, email: u.email, papel: u.papel.tipo };
  return { token: tokens.gerar({ id: u.id, nome: u.nome, email: u.email }), usuario };
};

export class RegistrarUsuario {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hash: GeradorDeHash,
    private readonly tokens: GeradorDeToken,
  ) {}

  async executar(dados: { nome: string; email: string; senha: string }): Promise<SessaoDto> {
    if (!dados.senha || dados.senha.length < 6) throw new RegraDeNegocioError('A senha precisa ter pelo menos 6 caracteres');
    if (await this.usuarios.buscarPorEmail(dados.email.trim().toLowerCase())) {
      throw new RegraDeNegocioError('Já existe uma conta com este e-mail');
    }
    const usuario = Usuario.criar(dados.nome, dados.email, await this.hash.gerar(dados.senha));
    await this.usuarios.salvar(usuario);
    return sessao(usuario, this.tokens);
  }
}

export class Autenticar {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hash: GeradorDeHash,
    private readonly tokens: GeradorDeToken,
  ) {}

  async executar(dados: { email: string; senha: string }): Promise<SessaoDto> {
    const usuario = await this.usuarios.buscarPorEmail(dados.email.trim().toLowerCase());
    // mesma mensagem nos dois casos para não revelar quais e-mails existem
    if (!usuario || !(await this.hash.comparar(dados.senha, usuario.senhaHash))) {
      throw new CredenciaisInvalidasError('E-mail ou senha incorretos');
    }
    return sessao(usuario, this.tokens);
  }
}
