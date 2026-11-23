import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { TokenJwt, UsuarioDoToken } from '../seguranca/seguranca';

type RequisicaoAutenticada = Request & { usuario?: UsuarioDoToken };

/** Guard: exige um JWT válido no cabeçalho Authorization: Bearer <token>. */
@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(private readonly tokens: TokenJwt) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');
    try {
      req.usuario = this.tokens.verificar(token);
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente');
    }
  }
}

/** Decorator: injeta o usuário logado no parâmetro do controller. */
export const UsuarioAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioDoToken => {
  return ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario!;
});
