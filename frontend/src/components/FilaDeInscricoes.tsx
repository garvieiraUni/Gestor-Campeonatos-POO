import { FormEvent, useState } from 'react';
import { mensagemDeErro } from '../api/cliente';
import { useAcaoNoCampeonato } from '../api/hooks';
import { CampeonatoDetalhe, Equipe, NivelBanimento, pode } from '../api/tipos';
import { Aviso, Botao, Painel, SeloInscricao, Vazio } from './ui';

/** Inscrições enviadas por espectadores: aprovar, recusar com motivo e banir a conta. */
export function FilaDeInscricoes({ c }: { c: CampeonatoDetalhe }) {
  const fila = c.equipes.filter((e) => e.status !== 'APROVADA');
  const pendentes = fila.filter((e) => e.status === 'PENDENTE');
  const recusadas = fila.filter((e) => e.status === 'RECUSADA');

  return (
    <div className="space-y-6">
      <Painel titulo={`Aguardando aprovação (${pendentes.length})`}>
        {pendentes.length ? (
          <ul className="divide-y divide-linha">
            {pendentes.map((e) => (
              <ItemDaFila key={e.id} c={c} equipe={e} />
            ))}
          </ul>
        ) : (
          <Vazio>Nenhuma inscrição esperando.</Vazio>
        )}
      </Painel>

      {recusadas.length > 0 && (
        <Painel titulo={`Recusadas (${recusadas.length})`}>
          <ul className="divide-y divide-linha">
            {recusadas.map((e) => (
              <ItemDaFila key={e.id} c={c} equipe={e} />
            ))}
          </ul>
          <p className="border-t border-linha px-4 py-2 text-xs text-suave">O espectador vê o motivo e pode corrigir e reenviar. Times recusados saem quando o campeonato começa.</p>
        </Painel>
      )}

      {pode(c, 'BANIR') && <ListaDeBanidos c={c} />}
    </div>
  );
}

function ItemDaFila({ c, equipe }: { c: CampeonatoDetalhe; equipe: Equipe }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [modo, setModo] = useState<'ver' | 'recusar' | 'banir'>('ver');
  const [motivo, setMotivo] = useState('');
  const [nivel, setNivel] = useState<NivelBanimento>('INSCRICAO');
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (fn: () => Promise<unknown>) => {
    setErro(null);
    try {
      await fn();
      setModo('ver');
      setMotivo('');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  const recusar = (e: FormEvent) => {
    e.preventDefault();
    void executar(() => acao.mutateAsync({ caminho: `/equipes/${equipe.id}/recusar`, corpo: { motivo } }));
  };
  const banir = (e: FormEvent) => {
    e.preventDefault();
    void executar(() => acao.mutateAsync({ caminho: '/banimentos', corpo: { usuarioId: equipe.responsavel!.id, nivel, motivo: motivo || undefined } }));
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold uppercase">{equipe.nome}</span>
            <SeloInscricao status={equipe.status} />
          </span>
          <span className="block text-xs text-suave">
            Enviado por {equipe.responsavel?.nome ?? '?'} · {equipe.jogadores.length} jogadores · {aberto ? 'esconder elenco' : 'ver elenco'}
          </span>
        </button>
        {equipe.status === 'PENDENTE' && c.status === 'INSCRICOES_ABERTAS' && (
          <div className="flex gap-2">
            <Botao className="!py-1.5" carregando={acao.isPending && modo === 'ver'} onClick={() => void executar(() => acao.mutateAsync({ caminho: `/equipes/${equipe.id}/aprovar` }))}>
              Aprovar
            </Botao>
            <Botao variante="secundario" className="!py-1.5" onClick={() => setModo(modo === 'recusar' ? 'ver' : 'recusar')}>
              Recusar
            </Botao>
          </div>
        )}
        {pode(c, 'BANIR') && equipe.responsavel && (
          <Botao variante="fantasma" className="!px-2 !py-1.5 text-xs" onClick={() => setModo(modo === 'banir' ? 'ver' : 'banir')}>
            Banir conta
          </Botao>
        )}
      </div>

      {equipe.status === 'RECUSADA' && <p className="mt-1 text-sm text-vermelho">Motivo: {equipe.motivoRecusa}</p>}

      {aberto && (
        <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">
          {equipe.jogadores.map((j) => (
            <li key={j.id} className="flex gap-2 py-0.5">
              <span className="numeros w-6 text-right font-bold text-suave">{j.numero}</span>
              <span className="flex-1">{j.nome}</span>
              <span className="text-xs text-suave">{j.documento}</span>
            </li>
          ))}
        </ul>
      )}

      {modo === 'recusar' && (
        <form onSubmit={recusar} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-md border border-linha bg-papel px-3 py-1.5 text-sm"
            placeholder="Motivo da recusa (o espectador vai ver)"
            required
            minLength={3}
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo da recusa"
          />
          <Botao type="submit" variante="perigo" className="!py-1.5" carregando={acao.isPending}>
            Confirmar recusa
          </Botao>
        </form>
      )}

      {modo === 'banir' && (
        <form onSubmit={banir} className="mt-3 space-y-2 rounded-lg border border-vermelho/30 bg-vermelho/5 p-3">
          <p className="text-sm">
            Banir <strong>{equipe.responsavel?.nome}</strong> deste campeonato. Um time pendente dessa conta é recusado na hora.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="rounded-md border border-linha bg-cartao px-2 py-1.5 text-sm" value={nivel} onChange={(e) => setNivel(e.target.value as NivelBanimento)} aria-label="Nível do banimento">
              <option value="INSCRICAO">Não pode inscrever times</option>
              <option value="VISUALIZACAO">Não pode inscrever nem ver o campeonato</option>
            </select>
            <input className="min-w-0 flex-1 rounded-md border border-linha bg-cartao px-3 py-1.5 text-sm" placeholder="Motivo (opcional)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do banimento" />
            <Botao type="submit" variante="perigo" className="!py-1.5" carregando={acao.isPending}>
              Banir
            </Botao>
          </div>
        </form>
      )}

      {erro && (
        <div className="mt-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </li>
  );
}

function ListaDeBanidos({ c }: { c: CampeonatoDetalhe }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [erro, setErro] = useState<string | null>(null);
  if (!c.banimentos.length) return null;
  return (
    <Painel titulo={`Contas banidas (${c.banimentos.length})`}>
      <ul className="divide-y divide-linha text-sm">
        {c.banimentos.map((b) => (
          <li key={b.usuario.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="flex-1">
              <strong>{b.usuario.nome}</strong>
              <span className="ml-2 text-xs text-suave">
                {b.nivel === 'VISUALIZACAO' ? 'não vê nem inscreve' : 'não inscreve times'}
                {b.motivo && ` · ${b.motivo}`}
              </span>
            </span>
            <Botao
              variante="secundario"
              className="!py-1 text-xs"
              onClick={async () => {
                setErro(null);
                try {
                  await acao.mutateAsync({ metodo: 'delete', caminho: `/banimentos/${b.usuario.id}` });
                } catch (e) {
                  setErro(mensagemDeErro(e));
                }
              }}
            >
              Desbanir
            </Botao>
          </li>
        ))}
      </ul>
      {erro && (
        <div className="p-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Painel>
  );
}
