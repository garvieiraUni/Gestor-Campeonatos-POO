import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { Ator, USUARIO_REPOSITORY, UsuarioRepository } from '../../domain';
import { TokenJwt } from '../seguranca/seguranca';

type RequisicaoComAtor = Request & { ator?: Ator };

/** Cabeçalho com a chave do link de acesso de um campeonato privado. */
export const CABECALHO_CHAVE = 'x-chave-acesso';

/**
 * Lê o token e recarrega a conta do banco: assim um ADM rebaixado (ou uma conta apagada)
 * perde o acesso na hora, sem esperar o token expirar.
 */
@Injectable()
export class LeitorDeSessao {
  constructor(
    private readonly tokens: TokenJwt,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
  ) {}

  /** null = sem cabeçalho; lança se o token for inválido ou a conta não existir mais. */
  async ler(req: Request): Promise<Ator | null> {
    const cabecalho = req.headers.authorization;
    if (!cabecalho) return null;
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');
    let id: string;
    try {
      id = this.tokens.verificar(token).id;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente');
    }
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new UnauthorizedException('Sessão expirada. Faça login novamente');
    return Ator.deUsuario(usuario);
  }
}

/** Guard: exige um JWT válido no cabeçalho Authorization: Bearer <token>. */
@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(private readonly sessao: LeitorDeSessao) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequisicaoComAtor>();
    const ator = await this.sessao.ler(req);
    if (!ator) throw new UnauthorizedException('Faça login para continuar');
    req.ator = ator;
    return true;
  }
}

/**
 * Guard das rotas de leitura: o login é opcional. Sem token, a pessoa é um visitante;
 * com um token vencido também (para não quebrar a página pública de quem esqueceu a sessão aberta).
 */
@Injectable()
export class AutenticacaoOpcionalGuard implements CanActivate {
  constructor(private readonly sessao: LeitorDeSessao) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequisicaoComAtor>();
    try {
      req.ator = (await this.sessao.ler(req)) ?? Ator.visitante();
    } catch {
      req.ator = Ator.visitante();
    }
    return true;
  }
}

/** Decorator: injeta quem fez a requisição (visitante ou conta logada). */
export const AtorAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Ator => {
  return ctx.switchToHttp().getRequest<RequisicaoComAtor>().ator ?? Ator.visitante();
});

/** Decorator: a chave de acesso enviada pelo frontend (campeonatos privados). */
export const ChaveInformada = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const valor = ctx.switchToHttp().getRequest<Request>().headers[CABECALHO_CHAVE];
  return typeof valor === 'string' && valor ? valor : null;
});
