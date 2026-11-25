import { AcessoNegadoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novaChave, novoId } from '../compartilhado/id';

export type TipoConvite = 'EMAIL' | 'LINK';
export type StatusConvite = 'PENDENTE' | 'ACEITO' | 'RECUSADO' | 'REVOGADO';

export interface ConviteSnapshot {
  id: Id;
  tipo: TipoConvite;
  /** Só para convite por e-mail. */
  email: string | null;
  /** Só para convite por link. */
  token: string | null;
  status: StatusConvite;
  criadoPor: Id;
  criadoEm: string;
  /** Contas que entraram na organização por este convite. */
  aceitoPor: Id[];
}

/** Dados da conta que tenta aceitar ou recusar um convite. */
export interface ContaConvidada {
  id: Id;
  email: string;
}

/**
 * Convite para organizar um campeonato (classe abstrata + polimorfismo).
 * `aceitar` é um Template Method: as checagens são iguais para todos,
 * e cada subclasse decide QUEM pode aceitar e O QUE acontece depois.
 */
export abstract class Convite {
  protected constructor(protected readonly s: ConviteSnapshot) {}

  get id(): Id {
    return this.s.id;
  }
  get tipo(): TipoConvite {
    return this.s.tipo;
  }
  get status(): StatusConvite {
    return this.s.status;
  }
  get criadoPor(): Id {
    return this.s.criadoPor;
  }
  get ativo(): boolean {
    return this.s.status === 'PENDENTE';
  }

  aceitar(conta: ContaConvidada): void {
    if (!this.ativo) throw new RegraDeNegocioError('Este convite não está mais válido');
    if (!this.podeSerAceitoPor(conta)) throw new AcessoNegadoError('Este convite não é para a sua conta');
    this.s.aceitoPor.push(conta.id);
    this.depoisDeAceito();
  }

  revogar(): void {
    if (!this.ativo) throw new RegraDeNegocioError('Este convite não está mais ativo');
    this.s.status = 'REVOGADO';
  }

  abstract recusar(conta: ContaConvidada): void;
  protected abstract podeSerAceitoPor(conta: ContaConvidada): boolean;
  protected abstract depoisDeAceito(): void;

  snapshot(): ConviteSnapshot {
    return { ...this.s, aceitoPor: [...this.s.aceitoPor] };
  }
}

/** Para uma conta específica (pelo e-mail). Uso único: aceito ou recusado, acabou. */
export class ConvitePorEmail extends Convite {
  constructor(s: ConviteSnapshot) {
    super(s);
  }

  get email(): string {
    return this.s.email!;
  }

  ehPara(email: string): boolean {
    return this.email === email.trim().toLowerCase();
  }

  recusar(conta: ContaConvidada): void {
    if (!this.ativo) throw new RegraDeNegocioError('Este convite não está mais válido');
    if (!this.ehPara(conta.email)) throw new AcessoNegadoError('Este convite não é para a sua conta');
    this.s.status = 'RECUSADO';
  }

  protected podeSerAceitoPor(conta: ContaConvidada): boolean {
    return this.ehPara(conta.email);
  }

  protected depoisDeAceito(): void {
    this.s.status = 'ACEITO';
  }
}

/** Link que qualquer conta logada pode usar, quantas vezes for, até ser revogado. */
export class ConvitePorLink extends Convite {
  constructor(s: ConviteSnapshot) {
    super(s);
  }

  get token(): string {
    return this.s.token!;
  }

  recusar(): void {
    throw new RegraDeNegocioError('Um convite por link não precisa ser recusado: basta não usá-lo');
  }

  protected podeSerAceitoPor(conta: ContaConvidada): boolean {
    return !this.s.aceitoPor.includes(conta.id);
  }

  protected depoisDeAceito(): void {
    /* continua ativo para as próximas contas */
  }
}

/** Factory: cria a subclasse certa (novo convite ou vindo do banco). */
export class ConviteFactory {
  static porEmail(email: string, criadoPor: Id): ConvitePorEmail {
    const e = email?.trim().toLowerCase();
    garantir(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 'E-mail inválido');
    return new ConvitePorEmail(ConviteFactory.base('EMAIL', criadoPor, { email: e }));
  }

  static porLink(criadoPor: Id): ConvitePorLink {
    return new ConvitePorLink(ConviteFactory.base('LINK', criadoPor, { token: novaChave() }));
  }

  static restaurar(s: ConviteSnapshot): Convite {
    const copia = { ...s, aceitoPor: [...s.aceitoPor] };
    switch (s.tipo) {
      case 'EMAIL':
        return new ConvitePorEmail(copia);
      case 'LINK':
        return new ConvitePorLink(copia);
      default:
        throw new RegraDeNegocioError(`Tipo de convite desconhecido: ${String(s.tipo)}`);
    }
  }

  private static base(tipo: TipoConvite, criadoPor: Id, extra: { email?: string; token?: string }): ConviteSnapshot {
    return {
      id: novoId(),
      tipo,
      email: extra.email ?? null,
      token: extra.token ?? null,
      status: 'PENDENTE',
      criadoPor,
      criadoEm: new Date().toISOString(),
      aceitoPor: [],
    };
  }
}
