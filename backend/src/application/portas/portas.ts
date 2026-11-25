/** Portas de saída da aplicação: a infraestrutura fornece as implementações. */
export interface GeradorDeHash {
  gerar(texto: string): Promise<string>;
  comparar(texto: string, hash: string): Promise<boolean>;
}

export interface GeradorDeToken {
  gerar(dados: { id: string; nome: string; email: string }): string;
}

export const GERADOR_DE_HASH = Symbol('GeradorDeHash');
export const GERADOR_DE_TOKEN = Symbol('GeradorDeToken');
