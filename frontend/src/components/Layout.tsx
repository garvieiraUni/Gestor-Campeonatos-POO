import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMeusConvites } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';

const estiloLink = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-1.5 ${isActive ? 'bg-tinta/5 font-semibold' : 'text-suave hover:text-tinta'}`;

export function Layout() {
  const { usuario, ehAdm, sair } = useAuth();
  const navegar = useNavigate();
  const { data: convites } = useMeusConvites(!!usuario);

  return (
    <div className="min-h-screen">
      <header className="border-b border-linha bg-cartao/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
            <span className="truncate font-display text-xl font-bold uppercase leading-none tracking-wide sm:text-2xl">
              Gestor <span className="hidden text-campo sm:inline">de Campeonatos</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <NavLink to="/" end className={(p) => `hidden sm:inline-block ${estiloLink(p)}`}>
              Campeonatos
            </NavLink>
            {usuario ? (
              <>
                <NavLink to="/novo" className={estiloLink}>
                  <span className="sm:hidden">+ Novo</span>
                  <span className="hidden sm:inline">Novo campeonato</span>
                </NavLink>
                <NavLink to="/convites" className={estiloLink}>
                  Convites
                  {!!convites?.length && (
                    <span className="numeros ml-1.5 rounded-full bg-campo px-1.5 py-0.5 text-[11px] font-bold text-white">{convites.length}</span>
                  )}
                </NavLink>
                <span className="ml-2 hidden items-center gap-1.5 text-suave sm:inline-flex">
                  Olá, {usuario.nome.split(' ')[0]}
                  {ehAdm && <span className="rounded-full bg-vermelho/10 px-2 py-0.5 text-[11px] font-bold text-vermelho">ADM</span>}
                </span>
                <button
                  onClick={() => {
                    sair();
                    navegar('/');
                  }}
                  className="rounded-lg px-3 py-1.5 text-suave hover:text-tinta"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className="rounded-lg bg-campo px-3 py-1.5 font-semibold text-white">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
