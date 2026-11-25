import { RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';

export type TipoEvento = 'GOL' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO';
export const TIPOS_EVENTO: readonly TipoEvento[] = ['GOL', 'CARTAO_AMARELO', 'CARTAO_VERMELHO'];

export interface EventoSnapshot {
  id: Id;
  tipo: TipoEvento;
  jogadorId: Id;
  equipeId: Id;
  minuto: number;
  /** Só para cartão vermelho: true quando foi gerado pelo segundo amarelo. */
  segundoAmarelo: boolean;
}

/**
 * Acumula os números de uma partida. Cada evento sabe como se aplicar
 * aqui (polimorfismo): a Partida não precisa de if/switch por tipo.
 */
export class EstatisticasPartida {
  private readonly gols = new Map<Id, number>();
  private readonly fairPlay = new Map<Id, number>();

  registrarGol(equipeId: Id): void {
    this.gols.set(equipeId, (this.gols.get(equipeId) ?? 0) + 1);
  }

  registrarPontosFairPlay(equipeId: Id, pontos: number): void {
    this.fairPlay.set(equipeId, (this.fairPlay.get(equipeId) ?? 0) + pontos);
  }

  golsDe(equipeId: Id): number {
    return this.gols.get(equipeId) ?? 0;
  }

  fairPlayDe(equipeId: Id): number {
    return this.fairPlay.get(equipeId) ?? 0;
  }
}

/** Classe base abstrata dos eventos de uma súmula (herança + polimorfismo). */
export abstract class EventoPartida {
  abstract readonly tipo: TipoEvento;

  constructor(
    readonly id: Id,
    readonly jogadorId: Id,
    readonly equipeId: Id,
    readonly minuto: number,
  ) {
    garantir(Number.isInteger(minuto) && minuto >= 0 && minuto <= 200, 'O minuto deve ser um inteiro entre 0 e 200');
  }

  /** Cada subclasse decide o que muda nas estatísticas. */
  abstract aplicarEm(estatisticas: EstatisticasPartida): void;

  /** Pontos negativos de fair play (R8). Gol não pesa. */
  pontosFairPlay(): number {
    return 0;
  }

  snapshot(): EventoSnapshot {
    return {
      id: this.id,
      tipo: this.tipo,
      jogadorId: this.jogadorId,
      equipeId: this.equipeId,
      minuto: this.minuto,
      segundoAmarelo: false,
    };
  }
}

export class Gol extends EventoPartida {
  readonly tipo = 'GOL' as const;

  aplicarEm(estatisticas: EstatisticasPartida): void {
    estatisticas.registrarGol(this.equipeId);
  }
}

export class CartaoAmarelo extends EventoPartida {
  readonly tipo = 'CARTAO_AMARELO' as const;

  pontosFairPlay(): number {
    return 1;
  }

  aplicarEm(estatisticas: EstatisticasPartida): void {
    estatisticas.registrarPontosFairPlay(this.equipeId, this.pontosFairPlay());
  }
}

export class CartaoVermelho extends EventoPartida {
  readonly tipo = 'CARTAO_VERMELHO' as const;

  constructor(id: Id, jogadorId: Id, equipeId: Id, minuto: number, readonly segundoAmarelo = false) {
    super(id, jogadorId, equipeId, minuto);
  }

  pontosFairPlay(): number {
    return 3;
  }

  aplicarEm(estatisticas: EstatisticasPartida): void {
    estatisticas.registrarPontosFairPlay(this.equipeId, this.pontosFairPlay());
  }

  snapshot(): EventoSnapshot {
    return { ...super.snapshot(), segundoAmarelo: this.segundoAmarelo };
  }
}

/** Factory: transforma um tipo (vindo da API ou do banco) na subclasse certa. */
export class EventoFactory {
  static criar(tipo: TipoEvento, jogadorId: Id, equipeId: Id, minuto: number): EventoPartida {
    return EventoFactory.restaurar({ id: novoId(), tipo, jogadorId, equipeId, minuto, segundoAmarelo: false });
  }

  static restaurar(s: EventoSnapshot): EventoPartida {
    switch (s.tipo) {
      case 'GOL':
        return new Gol(s.id, s.jogadorId, s.equipeId, s.minuto);
      case 'CARTAO_AMARELO':
        return new CartaoAmarelo(s.id, s.jogadorId, s.equipeId, s.minuto);
      case 'CARTAO_VERMELHO':
        return new CartaoVermelho(s.id, s.jogadorId, s.equipeId, s.minuto, s.segundoAmarelo);
      default:
        throw new RegraDeNegocioError(`Tipo de evento desconhecido: ${String(s.tipo)}`);
    }
  }
}
