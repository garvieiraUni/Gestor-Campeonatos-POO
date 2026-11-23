import {
  AcessoNegadoError,
  Campeonato,
  CampeonatoRepository,
  Id,
  NaoEncontradoError,
  Placar,
  RegulamentoProps,
  TipoEvento,
} from '../../domain';

// ---------------------------------------------------------------------------
// Consultas (qualquer visitante)
// ---------------------------------------------------------------------------

export class ListarCampeonatos {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(): Promise<Campeonato[]> {
    const todos = await this.campeonatos.listar();
    return todos.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }
}

export class ObterCampeonato {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(id: Id): Promise<Campeonato> {
    const c = await this.campeonatos.buscarPorId(id);
    if (!c) throw new NaoEncontradoError('Campeonato não encontrado');
    return c;
  }
}

export class CriarCampeonato {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(dados: {
    organizadorId: Id;
    nome: string;
    descricao?: string;
    modalidade?: string;
    regulamento?: Partial<RegulamentoProps>;
  }): Promise<Campeonato> {
    const c = Campeonato.criar(dados);
    await this.campeonatos.salvar(c);
    return c;
  }
}

// ---------------------------------------------------------------------------
// Alterações (só o organizador do campeonato) — Template Method
// ---------------------------------------------------------------------------

/**
 * Template Method: o algoritmo "carregar → conferir dono → aplicar → salvar"
 * é fixo aqui; cada caso de uso só implementa o passo `aplicar`.
 */
export abstract class CasoDeUsoDoOrganizador<TEntrada> {
  constructor(private readonly campeonatos: CampeonatoRepository) {}

  async executar(campeonatoId: Id, usuarioId: Id, entrada: TEntrada): Promise<Campeonato> {
    const c = await this.campeonatos.buscarPorId(campeonatoId);
    if (!c) throw new NaoEncontradoError('Campeonato não encontrado');
    if (!c.ehOrganizador(usuarioId)) throw new AcessoNegadoError('Só o organizador pode alterar este campeonato');
    this.aplicar(c, entrada);
    await this.campeonatos.salvar(c);
    return c;
  }

  protected abstract aplicar(campeonato: Campeonato, entrada: TEntrada): void;
}

export class InscreverEquipe extends CasoDeUsoDoOrganizador<{ nome: string }> {
  protected aplicar(c: Campeonato, e: { nome: string }): void {
    c.inscreverEquipe(e.nome);
  }
}

export class RemoverEquipe extends CasoDeUsoDoOrganizador<{ equipeId: Id }> {
  protected aplicar(c: Campeonato, e: { equipeId: Id }): void {
    c.removerEquipe(e.equipeId);
  }
}

export interface NovoJogador {
  equipeId: Id;
  nome: string;
  numero: number;
  documento: string;
  posicao?: string | null;
}

export class AdicionarJogador extends CasoDeUsoDoOrganizador<NovoJogador> {
  protected aplicar(c: Campeonato, { equipeId, ...dados }: NovoJogador): void {
    c.adicionarJogador(equipeId, dados);
  }
}

export class RemoverJogador extends CasoDeUsoDoOrganizador<{ equipeId: Id; jogadorId: Id }> {
  protected aplicar(c: Campeonato, e: { equipeId: Id; jogadorId: Id }): void {
    c.removerJogador(e.equipeId, e.jogadorId);
  }
}

export class IniciarCampeonato extends CasoDeUsoDoOrganizador<void> {
  protected aplicar(c: Campeonato): void {
    c.iniciar();
  }
}

export class IniciarPartida extends CasoDeUsoDoOrganizador<{ partidaId: Id }> {
  protected aplicar(c: Campeonato, e: { partidaId: Id }): void {
    c.iniciarPartida(e.partidaId);
  }
}

export interface NovoEvento {
  partidaId: Id;
  tipo: TipoEvento;
  jogadorId: Id;
  minuto: number;
}

export class RegistrarEvento extends CasoDeUsoDoOrganizador<NovoEvento> {
  protected aplicar(c: Campeonato, { partidaId, ...evento }: NovoEvento): void {
    c.registrarEvento(partidaId, evento);
  }
}

export class RemoverEvento extends CasoDeUsoDoOrganizador<{ partidaId: Id; eventoId: Id }> {
  protected aplicar(c: Campeonato, e: { partidaId: Id; eventoId: Id }): void {
    c.removerEvento(e.partidaId, e.eventoId);
  }
}

export class FinalizarPartida extends CasoDeUsoDoOrganizador<{ partidaId: Id; penaltis?: Placar | null }> {
  protected aplicar(c: Campeonato, e: { partidaId: Id; penaltis?: Placar | null }): void {
    c.finalizarPartida(e.partidaId, e.penaltis);
  }
}
