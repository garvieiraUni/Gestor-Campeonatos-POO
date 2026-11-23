import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();

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
            <NavLink to="/" end className={({ isActive }) => `hidden rounded-lg px-3 py-1.5 sm:inline-block ${isActive ? 'bg-tinta/5 font-semibold' : 'text-suave hover:text-tinta'}`}>
              Campeonatos
            </NavLink>
            {usuario ? (
              <>
                <NavLink
                  to="/novo"
                  className={({ isActive }) => `rounded-lg px-3 py-1.5 ${isActive ? 'bg-tinta/5 font-semibold' : 'text-suave hover:text-tinta'}`}
                >
                  <span className="sm:hidden">+ Novo</span>
                  <span className="hidden sm:inline">Novo campeonato</span>
                </NavLink>
                <span className="ml-2 hidden text-suave sm:inline">Olá, {usuario.nome.split(' ')[0]}</span>
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
