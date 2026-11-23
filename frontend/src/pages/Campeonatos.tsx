import { Link } from 'react-router-dom';
import { useCampeonatos } from '../api/hooks';
import { mensagemDeErro } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Carregando, ROTULO_FORMATO, SeloStatus } from '../components/ui';

export function Campeonatos() {
  const { data, isLoading, error } = useCampeonatos();
  const { usuario } = useAuth();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase">Campeonatos</h1>
          <p className="text-sm text-suave">Tabelas, rodadas, chaveamento e artilharia calculados automaticamente.</p>
        </div>
        {usuario && (
          <Link to="/novo" className="rounded-lg bg-campo px-4 py-2 text-sm font-semibold text-white">
            + Novo campeonato
          </Link>
        )}
      </div>

      {isLoading && <Carregando />}
      {error && (
        <div className="mt-6">
          <Aviso>{mensagemDeErro(error)}</Aviso>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((c) => {
          const progresso = c.partidasTotais ? Math.round((c.partidasJogadas / c.partidasTotais) * 100) : 0;
          return (
            <Link
              key={c.id}
              to={`/campeonatos/${c.id}`}
              className="group flex flex-col rounded-xl border border-linha bg-cartao p-5 transition hover:-translate-y-0.5 hover:border-campo hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-suave">{c.modalidade}</span>
                <SeloStatus status={c.status} />
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight group-hover:text-campo">{c.nome}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-suave">{c.descricao || ROTULO_FORMATO[c.formato]}</p>
              <div className="mt-auto pt-4 text-sm">
                {c.campeao ? (
                  <p className="font-medium">
                    <span className="text-amarelo">★</span> Campeão: {c.campeao.nome}
                  </p>
                ) : (
                  <p className="text-suave">
                    {c.quantidadeDeEquipes} equipes · {ROTULO_FORMATO[c.formato]}
                    {c.faseAtual && ` · ${c.faseAtual}`}
                  </p>
                )}
                {c.partidasTotais > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 flex-1 rounded-full bg-campo/15">
                      <span className="block h-1.5 rounded-full bg-campo" style={{ width: `${progresso}%` }} />
                    </span>
                    <span className="numeros text-xs text-suave">
                      {c.partidasJogadas}/{c.partidasTotais}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {data && !data.length && <p className="mt-10 text-center text-suave">Nenhum campeonato ainda. Entre e crie o primeiro.</p>}
    </div>
  );
}
