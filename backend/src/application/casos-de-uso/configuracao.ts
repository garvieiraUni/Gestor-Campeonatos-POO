import { Acao, Campeonato, RegulamentoProps, TipoModoInscricao, TipoVisibilidade } from '../../domain';
import { CasoDeUsoNoCampeonato } from './base';

export interface NovaConfiguracao {
  nome?: string;
  descricao?: string;
  modalidade?: string;
  visibilidade?: TipoVisibilidade;
  modoInscricao?: TipoModoInscricao;
}

/** Só o criador: dados básicos, visibilidade e modo de inscrição (a qualquer momento). */
export class AlterarConfiguracao extends CasoDeUsoNoCampeonato<NovaConfiguracao> {
  protected readonly acao = Acao.CONFIGURAR;
  protected aplicar(c: Campeonato, e: NovaConfiguracao): void {
    c.alterarDadosBasicos(e);
    if (e.visibilidade) c.alterarVisibilidade(e.visibilidade);
    if (e.modoInscricao) c.alterarModoInscricao(e.modoInscricao);
  }
}

/** Organizadores, só antes do início (R18). */
export class AlterarRegulamento extends CasoDeUsoNoCampeonato<Partial<RegulamentoProps>> {
  protected readonly acao = Acao.EDITAR_REGULAMENTO;
  protected aplicar(c: Campeonato, e: Partial<RegulamentoProps>): void {
    c.alterarRegulamento(e);
  }
}

export class RegenerarChaveDeAcesso extends CasoDeUsoNoCampeonato<void> {
  protected readonly acao = Acao.CONFIGURAR;
  protected aplicar(c: Campeonato): void {
    c.regenerarChaveDeAcesso();
  }
}

/** Mesmo algoritmo do Template Method; só o gancho `persistir` muda: apaga em vez de salvar. */
export class ExcluirCampeonato extends CasoDeUsoNoCampeonato<void> {
  protected readonly acao = Acao.EXCLUIR;
  protected aplicar(): void {
    /* nada a alterar antes de excluir */
  }
  protected persistir(c: Campeonato): Promise<void> {
    return this.campeonatos.excluir(c.id);
  }
}
