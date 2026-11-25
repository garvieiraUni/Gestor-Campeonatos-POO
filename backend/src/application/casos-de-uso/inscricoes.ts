import { Acao, Ator, Campeonato, DadosDaInscricao, Id, NivelBanimento } from '../../domain';
import { CasoDeUsoNoCampeonato } from './base';

/** Espectador logado inscreve o próprio time com o elenco completo (R17). */
export class SolicitarInscricao extends CasoDeUsoNoCampeonato<DadosDaInscricao> {
  protected readonly acao = Acao.INSCREVER_PROPRIO_TIME;
  protected aplicar(c: Campeonato, dados: DadosDaInscricao, ator: Ator): void {
    c.solicitarInscricao(ator.conta.id, dados);
  }
}

/** Espectador corrige e reenvia uma inscrição recusada (R20). */
export class ReenviarInscricao extends CasoDeUsoNoCampeonato<DadosDaInscricao> {
  protected readonly acao = Acao.INSCREVER_PROPRIO_TIME;
  protected aplicar(c: Campeonato, dados: DadosDaInscricao, ator: Ator): void {
    c.reenviarInscricao(ator.conta.id, dados);
  }
}

export class AprovarInscricao extends CasoDeUsoNoCampeonato<{ equipeId: Id }> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, e: { equipeId: Id }): void {
    c.aprovarInscricao(e.equipeId);
  }
}

export class RecusarInscricao extends CasoDeUsoNoCampeonato<{ equipeId: Id; motivo: string }> {
  protected readonly acao = Acao.GERENCIAR_EQUIPES;
  protected aplicar(c: Campeonato, e: { equipeId: Id; motivo: string }): void {
    c.recusarInscricao(e.equipeId, e.motivo);
  }
}

export class BanirConta extends CasoDeUsoNoCampeonato<{ usuarioId: Id; nivel: NivelBanimento; motivo?: string }> {
  protected readonly acao = Acao.BANIR;
  protected aplicar(c: Campeonato, e: { usuarioId: Id; nivel: NivelBanimento; motivo?: string }, ator: Ator): void {
    c.banir(e.usuarioId, e.nivel, e.motivo ?? '', ator.conta.id);
  }
}

export class DesbanirConta extends CasoDeUsoNoCampeonato<{ usuarioId: Id }> {
  protected readonly acao = Acao.BANIR;
  protected aplicar(c: Campeonato, e: { usuarioId: Id }): void {
    c.desbanir(e.usuarioId);
  }
}
