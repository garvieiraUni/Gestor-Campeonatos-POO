/** Tudo o que alguém pode querer fazer em um campeonato. */
export enum Acao {
  VER = 'VER',
  INSCREVER_PROPRIO_TIME = 'INSCREVER_PROPRIO_TIME',
  /** Inscrever, editar e remover qualquer time; aprovar e recusar inscrições. */
  GERENCIAR_EQUIPES = 'GERENCIAR_EQUIPES',
  PREENCHER_SUMULA = 'PREENCHER_SUMULA',
  INICIAR = 'INICIAR',
  EDITAR_REGULAMENTO = 'EDITAR_REGULAMENTO',
  BANIR = 'BANIR',
  /** Nome, descrição, modalidade, visibilidade, modo de inscrição e link de acesso. */
  CONFIGURAR = 'CONFIGURAR',
  GERENCIAR_ORGANIZADORES = 'GERENCIAR_ORGANIZADORES',
  EXCLUIR = 'EXCLUIR',
}

export type TipoPapelNoCampeonato = 'BLOQUEADO' | 'VISITANTE' | 'ESPECTADOR' | 'ORGANIZADOR' | 'CRIADOR' | 'ADMINISTRADOR';

/**
 * Papel de alguém dentro de UM campeonato.
 *
 * Herança em cadeia: cada papel "é um" papel anterior com mais permissões
 * (Visitante → Espectador → OrganizadorConvidado → Criador → AdministradorGlobal).
 * Como nenhuma subclasse tira permissões da classe mãe, qualquer papel pode ser usado
 * onde se espera o papel anterior (princípio de substituição de Liskov).
 *
 * `pode()` é fixo aqui (Template Method); cada subclasse só redefine `permissoes()`.
 */
export abstract class PapelNoCampeonato {
  abstract readonly tipo: TipoPapelNoCampeonato;
  abstract readonly descricao: string;

  pode(acao: Acao): boolean {
    return this.permissoes().has(acao);
  }

  /** Lista enviada ao frontend para ele decidir o que mostrar. */
  acoes(): Acao[] {
    return Object.values(Acao).filter((a) => this.pode(a));
  }

  /** Faz parte da equipe que organiza o campeonato. */
  get fazParteDaOrganizacao(): boolean {
    return this.pode(Acao.GERENCIAR_EQUIPES);
  }

  protected permissoes(): Set<Acao> {
    return new Set();
  }
}

/** Banido de ver o campeonato, ou sem o link de um campeonato privado. */
export class Bloqueado extends PapelNoCampeonato {
  readonly tipo: TipoPapelNoCampeonato = 'BLOQUEADO';
  readonly descricao: string = 'Sem acesso';
}

/** Quem não está logado: só acompanha. */
export class Visitante extends PapelNoCampeonato {
  readonly tipo: TipoPapelNoCampeonato = 'VISITANTE';
  readonly descricao: string = 'Visitante';

  protected permissoes(): Set<Acao> {
    return new Set([...super.permissoes(), Acao.VER]);
  }
}

/** Conta logada sem cargo no campeonato: acompanha e pode inscrever o próprio time. */
export class Espectador extends Visitante {
  readonly tipo: TipoPapelNoCampeonato = 'ESPECTADOR';
  readonly descricao: string = 'Espectador';

  protected permissoes(): Set<Acao> {
    return new Set([...super.permissoes(), Acao.INSCREVER_PROPRIO_TIME]);
  }
}

/** Conta convidada pelo criador para ajudar a organizar. */
export class OrganizadorConvidado extends Espectador {
  readonly tipo: TipoPapelNoCampeonato = 'ORGANIZADOR';
  readonly descricao: string = 'Organizador';

  protected permissoes(): Set<Acao> {
    return new Set([
      ...super.permissoes(),
      Acao.GERENCIAR_EQUIPES,
      Acao.PREENCHER_SUMULA,
      Acao.INICIAR,
      Acao.EDITAR_REGULAMENTO,
      Acao.BANIR,
    ]);
  }
}

/** Quem criou o campeonato: cuida da essência dele e de quem organiza. */
export class Criador extends OrganizadorConvidado {
  readonly tipo: TipoPapelNoCampeonato = 'CRIADOR';
  readonly descricao: string = 'Criador';

  protected permissoes(): Set<Acao> {
    return new Set([...super.permissoes(), Acao.CONFIGURAR, Acao.GERENCIAR_ORGANIZADORES, Acao.EXCLUIR]);
  }
}

/** ADM do site: tudo, em qualquer campeonato. */
export class AdministradorGlobal extends Criador {
  readonly tipo: TipoPapelNoCampeonato = 'ADMINISTRADOR';
  readonly descricao: string = 'Administrador do site';

  protected permissoes(): Set<Acao> {
    return new Set(Object.values(Acao));
  }
}
