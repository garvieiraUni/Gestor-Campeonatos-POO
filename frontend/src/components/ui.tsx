import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Formato, Status } from '../api/tipos';

export const ROTULO_STATUS: Record<Status, string> = {
  INSCRICOES_ABERTAS: 'Inscrições abertas',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADO: 'Encerrado',
};

export const ROTULO_FORMATO: Record<Formato, string> = {
  PONTOS_CORRIDOS: 'Pontos corridos',
  MATA_MATA: 'Mata-mata',
  GRUPOS_E_MATA_MATA: 'Grupos + mata-mata',
};

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';

const ESTILO_BOTAO: Record<Variante, string> = {
  primario: 'bg-campo text-white hover:bg-[#08583a] disabled:bg-campo/50',
  secundario: 'bg-cartao text-tinta border border-linha hover:border-tinta/40',
  perigo: 'bg-cartao text-vermelho border border-vermelho/40 hover:bg-vermelho hover:text-white',
  fantasma: 'text-suave hover:text-tinta hover:bg-tinta/5',
};

export function Botao({
  variante = 'primario',
  className = '',
  carregando,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${ESTILO_BOTAO[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Campo({ rotulo, dica, ...props }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-linha bg-cartao px-3 py-2 text-sm outline-none transition focus:border-campo focus:ring-2 focus:ring-campo/20"
      />
      {dica && <span className="mt-1 block text-xs text-suave">{dica}</span>}
    </label>
  );
}

export function Selecao({
  rotulo,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{rotulo}</span>
      <select
        {...props}
        className="w-full rounded-lg border border-linha bg-cartao px-3 py-2 text-sm outline-none focus:border-campo focus:ring-2 focus:ring-campo/20"
      >
        {children}
      </select>
    </label>
  );
}

export function SeloStatus({ status }: { status: Status }) {
  const cor =
    status === 'EM_ANDAMENTO'
      ? 'bg-campo text-white'
      : status === 'INSCRICOES_ABERTAS'
        ? 'bg-amarelo/25 text-[#7a5a00]'
        : 'bg-tinta/10 text-suave';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}>
      {status === 'EM_ANDAMENTO' && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Aviso({ children, tipo = 'erro' }: { children: ReactNode; tipo?: 'erro' | 'info' }) {
  const cor = tipo === 'erro' ? 'border-vermelho/30 bg-vermelho/5 text-vermelho' : 'border-campo/30 bg-campo-claro text-campo';
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${cor}`}>
      {children}
    </div>
  );
}

export function Painel({ titulo, acao, children, className = '' }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border border-linha bg-cartao ${className}`}>
      {(titulo || acao) && (
        <header className="flex items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <h3 className="font-display text-lg font-semibold uppercase tracking-wide">{titulo}</h3>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-suave">{children}</p>;
}

export function Carregando() {
  return (
    <div className="flex justify-center py-20" aria-label="Carregando">
      <div className="size-8 animate-spin rounded-full border-4 border-campo/20 border-t-campo" />
    </div>
  );
}

/** Pequeno cartão (amarelo/vermelho) desenhado em CSS. */
export function CartaoIcone({ cor }: { cor: 'amarelo' | 'vermelho' }) {
  return <span className={`inline-block h-3.5 w-2.5 rounded-[2px] ${cor === 'amarelo' ? 'bg-amarelo' : 'bg-vermelho'}`} />;
}

export function BolaIcone() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5l2.6 1.9-1 3.1H6.4l-1-3.1z" fill="currentColor" />
    </svg>
  );
}
