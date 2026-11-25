import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  AcessoNegadoError,
  ConflitoDeVersaoError,
  CredenciaisInvalidasError,
  ErroDeDominio,
  NaoEncontradoError,
  RegraDeNegocioError,
} from '../../domain';

/** Traduz erros do domínio em respostas HTTP com uma mensagem clara para o frontend. */
@Catch()
export class FiltroDeErros implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(erro: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (erro instanceof ErroDeDominio) {
      const status =
        erro instanceof ConflitoDeVersaoError
          ? HttpStatus.CONFLICT
          : erro instanceof NaoEncontradoError
          ? HttpStatus.NOT_FOUND
          : erro instanceof AcessoNegadoError
            ? HttpStatus.FORBIDDEN
            : erro instanceof CredenciaisInvalidasError
              ? HttpStatus.UNAUTHORIZED
              : erro instanceof RegraDeNegocioError
                ? HttpStatus.UNPROCESSABLE_ENTITY
                : HttpStatus.BAD_REQUEST;
      res.status(status).json({ status, erro: erro.name, mensagem: erro.message });
      return;
    }

    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const corpo = erro.getResponse() as string | { message?: string | string[] };
      const msg = typeof corpo === 'string' ? corpo : corpo.message;
      res.status(status).json({ status, erro: erro.name, mensagem: Array.isArray(msg) ? msg.join('; ') : msg });
      return;
    }

    this.logger.error(erro);
    res.status(500).json({ status: 500, erro: 'ErroInterno', mensagem: 'Erro inesperado no servidor' });
  }
}
