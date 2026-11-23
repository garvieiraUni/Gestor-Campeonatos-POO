import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mensagemDeErro } from '../api/cliente';
import { useAcaoNoCampeonato, useCampeonato } from '../api/hooks';
import { CampeonatoDetalhe, EventoJson, PartidaJson, TipoEvento } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { Aviso, BolaIcone, Botao, Carregando, CartaoIcone, Painel } from '../components/ui';

/** Súmula da partida: o organizador registra gols e cartões; visitantes acompanham. */
export function Sumula() {
  const { id = '', partidaId = '' } = useParams();
  const { data: c, isLoading, error } = useCampeonato(id);
  const { usuario } = useAuth();
  const acao = useAcaoNoCampeonato(id);
  const [minuto, setMinuto] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [penaltis, setPenaltis] = useState({ mandante: '', visitante: '' });

  if (isLoading) return <Carregando />;
  if (error || !c) return <Aviso>{mensagemDeErro(error)}</Aviso>;
  const partida = c.fases.flatMap((f) => f.partidas).find((p) => p.id === partidaId);
  if (!partida) return <Aviso>Partida não encontrada.</Aviso>;

  const organizador = usuario?.id === c.organizadorId;
  const editando = organizador && partida.status === 'EM_ANDAMENTO' && c.status === 'EM_ANDAMENTO';
  const base = `/partidas/${partida.id}`;
  const empatada = partida.placar.mandante === partida.placar.visitante;

  const executar = async (caminho: string, corpo?: unknown, metodo: 'post' | 'delete' = 'post') => {
    setErro(null);
    try {
      await acao.mutateAsync({ caminho: base + caminho, corpo, metodo });
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };
  const registrar = (tipo: TipoEvento, jogadorId: string) => executar('/eventos', { tipo, jogadorId, minuto });
  const finalizar = () =>
    executar(
      '/finalizar',
      partida.eliminatoria && empatada ? { penaltisMandante: Number(penaltis.mandante), penaltisVisitante: Number(penaltis.visitante) } : {},
    );

  return (
    <div>
      <Link to={`/campeonatos/${c.id}`} className="text-sm text-suave hover:text-tinta">
        ← {c.nome}
      </Link>

      <Placar c={c} partida={partida} />

      {erro && (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {organizador && partida.status === 'AGENDADA' && c.status === 'EM_ANDAMENTO' && (
        <div className="mt-6 flex justify-center">
          <Botao onClick={() => executar('/iniciar')} carregando={acao.isPending} className="px-8 py-3 text-base">
            Iniciar partida
          </Botao>
        </div>
      )}

      {editando && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-linha bg-cartao p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            Minuto
            <input
              type="number"
              min={0}
              max={200}
              value={minuto}
              onChange={(e) => setMinuto(Math.max(0, Math.min(200, Number(e.target.value))))}
              className="numeros w-20 rounded-lg border border-linha bg-papel px-2 py-1.5 text-center font-display text-lg font-bold"
            />
          </label>
          <span className="hidden text-linha sm:inline">|</span>
          {partida.eliminatoria && empatada && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Pênaltis</span>
              <input aria-label="Pênaltis mandante" className="numeros w-14 rounded-lg border border-linha bg-papel px-2 py-1.5 text-center" value={penaltis.mandante} onChange={(e) => setPenaltis({ ...penaltis, mandante: e.target.value.replace(/\D/g, '') })} />
              <span>×</span>
              <input aria-label="Pênaltis visitante" className="numeros w-14 rounded-lg border border-linha bg-papel px-2 py-1.5 text-center" value={penaltis.visitante} onChange={(e) => setPenaltis({ ...penaltis, visitante: e.target.value.replace(/\D/g, '') })} />
            </div>
          )}
          <Botao variante="perigo" onClick={finalizar} carregando={acao.isPending}>
            Finalizar partida
          </Botao>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem_minmax(0,1fr)]">
        <Elenco c={c} partida={partida} lado="mandante" editando={editando} onEvento={registrar} />
        <LinhaDoTempo partida={partida} editando={editando} onRemover={(ev) => executar(`/eventos/${ev.id}`, undefined, 'delete')} />
        <Elenco c={c} partida={partida} lado="visitante" editando={editando} onEvento={registrar} />
      </div>
    </div>
  );
}

function Placar({ c, partida }: { c: CampeonatoDetalhe; partida: PartidaJson }) {
  const rotuloStatus = { AGENDADA: 'Agendada', EM_ANDAMENTO: 'Ao vivo', FINALIZADA: 'Encerrada' }[partida.status];
  return (
    <section className="mt-4 overflow-hidden rounded-2xl bg-tinta text-papel">
      <div className="flex items-center justify-between px-5 pt-4 text-xs uppercase tracking-widest text-papel/60">
        <span>
          {partida.fase}
          {partida.grupo && c.formato === 'GRUPOS_E_MATA_MATA' ? ` · Grupo ${partida.grupo}` : ''}
          {!partida.eliminatoria ? ` · Rodada ${partida.rodada}` : ''}
        </span>
        <span className={partida.status === 'EM_ANDAMENTO' ? 'flex items-center gap-1.5 font-semibold text-[#7fe0b0]' : ''}>
          {partida.status === 'EM_ANDAMENTO' && <span className="size-2 animate-pulse rounded-full bg-[#7fe0b0]" />}
          {rotuloStatus}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 pb-6 pt-3">
        <h2 className={`text-right font-display text-2xl font-bold uppercase leading-tight sm:text-4xl ${partida.vencedorId && partida.vencedorId !== partida.mandante.id ? 'text-papel/50' : ''}`}>
          {partida.mandante.nome}
        </h2>
        <div className="text-center">
          <div className="numeros font-display text-6xl font-bold leading-none sm:text-7xl">
            {partida.status === 'AGENDADA' ? '–' : `${partida.placar.mandante}:${partida.placar.visitante}`}
          </div>
          {partida.penaltis && (
            <div className="numeros mt-1 text-sm text-papel/70">
              pênaltis {partida.penaltis.mandante}–{partida.penaltis.visitante}
            </div>
          )}
        </div>
        <h2 className={`font-display text-2xl font-bold uppercase leading-tight sm:text-4xl ${partida.vencedorId && partida.vencedorId !== partida.visitante.id ? 'text-papel/50' : ''}`}>
          {partida.visitante.nome}
        </h2>
      </div>
    </section>
  );
}

function Elenco({
  c,
  partida,
  lado,
  editando,
  onEvento,
}: {
  c: CampeonatoDetalhe;
  partida: PartidaJson;
  lado: 'mandante' | 'visitante';
  editando: boolean;
  onEvento: (tipo: TipoEvento, jogadorId: string) => void;
}) {
  const equipe = c.equipes.find((e) => e.id === partida[lado].id);
  if (!equipe) return null;
  const doJogador = (id: string) => partida.eventos.filter((e) => e.jogador.id === id);

  return (
    <Painel titulo={equipe.nome}>
      <ul className="divide-y divide-linha/60">
        {equipe.jogadores.map((j) => {
          const eventos = doJogador(j.id);
          const suspenso = partida.suspensos.includes(j.id);
          const expulso = eventos.some((e) => e.tipo === 'CARTAO_VERMELHO');
          const bloqueado = suspenso || expulso;
          return (
            <li key={j.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${bloqueado ? 'bg-vermelho/[0.04]' : ''}`}>
              <span className="numeros w-6 text-right font-display text-base font-bold text-suave">{j.numero}</span>
              <span className={`min-w-0 flex-1 truncate ${bloqueado ? 'text-suave line-through decoration-vermelho/50' : ''}`}>{j.nome}</span>
              <span className="flex items-center gap-1">
                {eventos.map((e) =>
                  e.tipo === 'GOL' ? <BolaIcone key={e.id} /> : <CartaoIcone key={e.id} cor={e.tipo === 'CARTAO_AMARELO' ? 'amarelo' : 'vermelho'} />,
                )}
              </span>
              {suspenso && <span className="rounded bg-vermelho/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-vermelho">suspenso</span>}
              {editando && !bloqueado && (
                <span className="flex gap-1">
                  <BotaoEvento titulo={`Gol de ${j.nome}`} onClick={() => onEvento('GOL', j.id)}>
                    <BolaIcone />
                  </BotaoEvento>
                  <BotaoEvento titulo={`Amarelo para ${j.nome}`} onClick={() => onEvento('CARTAO_AMARELO', j.id)}>
                    <CartaoIcone cor="amarelo" />
                  </BotaoEvento>
                  <BotaoEvento titulo={`Vermelho para ${j.nome}`} onClick={() => onEvento('CARTAO_VERMELHO', j.id)}>
                    <CartaoIcone cor="vermelho" />
                  </BotaoEvento>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}

function BotaoEvento({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={titulo} aria-label={titulo} onClick={onClick} className="flex size-7 items-center justify-center rounded-md border border-linha bg-papel transition hover:border-tinta/40 active:scale-95">
      {children}
    </button>
  );
}

function LinhaDoTempo({ partida, editando, onRemover }: { partida: PartidaJson; editando: boolean; onRemover: (e: EventoJson) => void }) {
  const eventos = [...partida.eventos].sort((a, b) => a.minuto - b.minuto);
  const nome = (e: EventoJson) => (e.equipeId === partida.mandante.id ? partida.mandante.nome : partida.visitante.nome);
  const descricao = (e: EventoJson) =>
    e.tipo === 'GOL' ? 'Gol' : e.tipo === 'CARTAO_AMARELO' ? 'Cartão amarelo' : e.segundoAmarelo ? 'Expulso (2º amarelo)' : 'Cartão vermelho';
  return (
    <Painel titulo="Lances">
      {!eventos.length ? (
        <p className="px-4 py-8 text-center text-sm text-suave">{partida.status === 'AGENDADA' ? 'A partida ainda não começou.' : 'Nenhum lance registrado.'}</p>
      ) : (
        <ol className="divide-y divide-linha/60">
          {eventos.map((e) => (
            <li key={e.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${e.equipeId === partida.visitante.id ? 'flex-row-reverse text-right' : ''}`}>
              <span className="numeros w-8 shrink-0 font-display font-bold text-suave">{e.minuto}'</span>
              {e.tipo === 'GOL' ? <BolaIcone /> : <CartaoIcone cor={e.tipo === 'CARTAO_AMARELO' ? 'amarelo' : 'vermelho'} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.jogador.nome}</span>
                <span className="block truncate text-xs text-suave">
                  {descricao(e)} · {nome(e)}
                </span>
              </span>
              {editando && !e.segundoAmarelo && (
                <button onClick={() => onRemover(e)} className="text-xs text-suave hover:text-vermelho" title="Desfazer lance" aria-label="Desfazer lance">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Painel>
  );
}
