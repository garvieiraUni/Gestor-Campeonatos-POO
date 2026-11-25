import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/cliente';
import { chaves, useMeusConvites } from '../api/hooks';
import { CampeonatoDetalhe, ResumoDoConvite } from '../api/tipos';
import { Aviso, Botao, Carregando, Vazio } from '../components/ui';

/** "Meus convites": convites por e-mail para organizar campeonatos. */
export function MeusConvites() {
  const { data, isLoading, error } = useMeusConvites(true);
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  const responder = useMutation({
    mutationFn: async ({ convite, aceitar }: { convite: ResumoDoConvite; aceitar: boolean }) => {
      const url = `/campeonatos/${convite.campeonatoId}/convites/${convite.conviteId}/${aceitar ? 'aceitar' : 'recusar'}`;
      return { convite, aceitar, dados: (await api.post<CampeonatoDetalhe>(url)).data };
    },
    onSuccess: ({ convite, aceitar, dados }) => {
      void qc.invalidateQueries({ queryKey: chaves.convites });
      void qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
      if (aceitar) {
        qc.setQueryData(chaves.detalhe(convite.campeonatoId), dados);
        navegar(`/campeonatos/${convite.campeonatoId}?aba=organizacao`);
      }
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-bold uppercase">Convites</h1>
      <p className="text-sm text-suave">Convites para ajudar a organizar campeonatos.</p>
      {isLoading && <Carregando />}
      {error && <Aviso>{mensagemDeErro(error)}</Aviso>}
      {erro && (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {data?.map((cv) => (
          <li key={cv.conviteId} className="flex flex-wrap items-center gap-3 rounded-xl border border-linha bg-cartao p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-suave">Organizar</p>
              <p className="font-display text-xl font-bold uppercase">{cv.campeonato}</p>
            </div>
            <Botao carregando={responder.isPending} onClick={() => responder.mutate({ convite: cv, aceitar: true })}>
              Aceitar
            </Botao>
            <Botao variante="secundario" onClick={() => responder.mutate({ convite: cv, aceitar: false })}>
              Recusar
            </Botao>
          </li>
        ))}
      </ul>
      {data && !data.length && <Vazio>Você não tem convites pendentes.</Vazio>}
    </div>
  );
}

/** Página aberta pelo link de convite: mostra o campeonato e deixa aceitar. */
export function ConvitePorLink() {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const previa = useQuery({
    queryKey: ['convite-link', token],
    queryFn: async () => (await api.get<ResumoDoConvite>(`/convites/link/${encodeURIComponent(token)}`)).data,
    retry: false,
  });
  const aceitar = useMutation({
    mutationFn: async () => (await api.post<CampeonatoDetalhe>(`/convites/link/${encodeURIComponent(token)}/aceitar`)).data,
    onSuccess: (dados) => {
      qc.setQueryData(chaves.detalhe(dados.id), dados);
      void qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
      navegar(`/campeonatos/${dados.id}?aba=organizacao`);
    },
  });

  if (previa.isLoading) return <Carregando />;
  if (previa.error || !previa.data) return <Aviso>{mensagemDeErro(previa.error)}</Aviso>;
  const cv = previa.data;

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-linha bg-cartao p-6">
      <p className="text-xs uppercase tracking-wider text-suave">Convite para organizar</p>
      <h1 className="font-display text-3xl font-bold uppercase">{cv.campeonato}</h1>
      {cv.jaOrganiza ? (
        <>
          <Aviso tipo="info">Você já faz parte da organização deste campeonato.</Aviso>
          <Link className="text-sm font-semibold text-campo" to={`/campeonatos/${cv.campeonatoId}`}>
            Abrir o campeonato →
          </Link>
        </>
      ) : !cv.ativo ? (
        <Aviso>Este link de convite foi revogado.</Aviso>
      ) : (
        <>
          <p className="text-sm text-suave">
            Ao aceitar, você poderá inscrever e aprovar times, preencher súmulas e alterar o regulamento antes do início.
          </p>
          {aceitar.error && <Aviso>{mensagemDeErro(aceitar.error)}</Aviso>}
          <Botao onClick={() => aceitar.mutate()} carregando={aceitar.isPending}>
            Aceitar convite
          </Botao>
        </>
      )}
    </div>
  );
}
