import { garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';

export interface JogadorSnapshot {
  id: Id;
  nome: string;
  numero: number;
  /** Documento único (RA, CPF...) usado para impedir o mesmo jogador em duas equipes (R2). */
  documento: string;
  posicao: string | null;
}

export class Jogador {
  readonly id: Id;
  readonly nome: string;
  readonly numero: number;
  readonly documento: string;
  readonly posicao: string | null;

  private constructor(dados: JogadorSnapshot) {
    const nome = dados.nome?.trim();
    garantir(nome && nome.length >= 2, 'O nome do jogador precisa ter pelo menos 2 caracteres');
    garantir(
      Number.isInteger(dados.numero) && dados.numero >= 1 && dados.numero <= 99,
      'O número da camisa deve ser um inteiro entre 1 e 99',
    );
    const documento = dados.documento?.trim();
    garantir(documento, 'O documento do jogador é obrigatório');

    this.id = dados.id;
    this.nome = nome;
    this.numero = dados.numero;
    this.documento = documento;
    this.posicao = dados.posicao?.trim() || null;
  }

  static criar(dados: Omit<JogadorSnapshot, 'id' | 'posicao'> & { posicao?: string | null }): Jogador {
    return new Jogador({ id: novoId(), posicao: null, ...dados });
  }

  static restaurar(s: JogadorSnapshot): Jogador {
    return new Jogador(s);
  }

  snapshot(): JogadorSnapshot {
    return { id: this.id, nome: this.nome, numero: this.numero, documento: this.documento, posicao: this.posicao };
  }
}
