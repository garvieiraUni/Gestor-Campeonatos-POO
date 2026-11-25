/**
 * Hierarquia de erros do domínio.
 * A camada HTTP traduz cada tipo para um status (422, 404, 403...),
 * então o domínio nunca precisa saber que existe HTTP.
 */
export abstract class ErroDeDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Uma regra de negócio foi violada (vira HTTP 422). */
export class RegraDeNegocioError extends ErroDeDominio {}

/** Ação não permitida no estado atual (State pattern). */
export class TransicaoInvalidaError extends RegraDeNegocioError {}

/** Jogador cumpre suspensão e não pode participar da partida (R11). */
export class JogadorSuspensoError extends RegraDeNegocioError {}

/** Recurso não existe (vira HTTP 404). */
export class NaoEncontradoError extends ErroDeDominio {}

/** Usuário sem permissão para a ação (vira HTTP 403). */
export class AcessoNegadoError extends ErroDeDominio {}

/** Login inválido (vira HTTP 401). */
export class CredenciaisInvalidasError extends ErroDeDominio {}

export function garantir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new RegraDeNegocioError(mensagem);
}

/** Outra pessoa salvou o campeonato antes (lock otimista); vira HTTP 409. */
export class ConflitoDeVersaoError extends ErroDeDominio {}
