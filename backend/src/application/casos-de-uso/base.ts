import {
  Acao,
  Ator,
  Campeonato,
  CampeonatoRepository,
  Id,
  NaoEncontradoError,
  PapelNoCampeonato,
  PoliticaDeAcesso,
} from '../../domain';

/** Quem pede e, para campeonatos privados, a chave do link de acesso. */
export interface Contexto {
  ator: Ator;
  chave?: string | null;
}

/** O campeonato e o papel de quem pediu, para a apresentação esconder o que essa pessoa não pode ver. */
export interface CampeonatoVisto {
  campeonato: Campeonato;
  papel: PapelNoCampeonato;
}

export async function carregar(campeonatos: CampeonatoRepository, id: Id): Promise<Campeonato> {
  const c = await campeonatos.buscarPorId(id);
  if (!c) throw new NaoEncontradoError('Campeonato não encontrado');
  return c;
}

/**
 * Template Method: o algoritmo "carregar → conferir permissão → aplicar → persistir" é fixo aqui.
 * Cada caso de uso só diz QUAL ação exige (`acao`) e implementa o passo `aplicar`.
 * `persistir` é um gancho (hook) que o ExcluirCampeonato redefine.
 */
export abstract class CasoDeUsoNoCampeonato<TEntrada> {
  protected abstract readonly acao: Acao;
  protected readonly politica = new PoliticaDeAcesso();

  constructor(protected readonly campeonatos: CampeonatoRepository) {}

  async executar(campeonatoId: Id, ctx: Contexto, entrada: TEntrada): Promise<CampeonatoVisto> {
    const c = await carregar(this.campeonatos, campeonatoId);
    this.politica.exigir(ctx.ator, c, this.acao, ctx.chave);
    await this.aplicar(c, entrada, ctx.ator);
    await this.persistir(c);
    // o papel pode ter mudado (ex.: quem sai da organização vira espectador)
    return { campeonato: c, papel: this.politica.papelDe(ctx.ator, c, ctx.chave) };
  }

  protected abstract aplicar(campeonato: Campeonato, entrada: TEntrada, ator: Ator): void | Promise<void>;

  protected persistir(c: Campeonato): Promise<void> {
    return this.campeonatos.salvar(c);
  }
}
