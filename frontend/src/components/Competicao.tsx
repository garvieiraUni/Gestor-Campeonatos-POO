import { Link } from 'react-router-dom';
import { FaseJson, LinhaArtilharia, PartidaJson, SuspensaoJson, Tabela } from '../api/tipos';
import { CartaoIcone, Vazio } from './ui';

// ---------------------------------------------------------------------------
// Tabela de classificação
// ---------------------------------------------------------------------------

export function TabelaClassificacao({ tabela, classificados = 0 }: { tabela: Tabela; classificados?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="numeros w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-linha text-left text-xs uppercase tracking-wider text-suave">
            <th className="py-2 pl-4 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Equipe</th>
            <th className="px-1.5 py-2 text-right font-semibold text-tinta" title="Pontos">P</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Jogos">J</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Vitórias">V</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Empates">E</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Derrotas">D</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Gols pró">GP</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Gols contra">GC</th>
            <th className="px-1.5 py-2 text-right font-medium" title="Saldo de gols">SG</th>
            <th className="py-2 pl-2 pr-4 text-right font-medium" title="Pontos de cartão (menos é melhor)">FP</th>
          </tr>
        </thead>
        <tbody>
          {tabela.linhas.map((l) => (
            <tr key={l.equipeId} className="border-b border-linha/60 last:border-0">
              <td className="py-2.5 pl-4 pr-2">
                <span
                  className={`inline-flex size-6 items-center justify-center rounded text-xs font-semibold ${
                    l.posicao <= classificados ? 'bg-campo text-white' : 'text-suave'
                  }`}
                >
                  {l.posicao}
                </span>
              </td>
              <td className="py-2.5 pr-2 font-medium">{l.nome}</td>
              <td className="px-1.5 py-2.5 text-right font-bold">{l.pontos}</td>
              <td className="px-1.5 py-2.5 text-right text-suave">{l.jogos}</td>
              <td className="px-1.5 py-2.5 text-right">{l.vitorias}</td>
              <td className="px-1.5 py-2.5 text-right">{l.empates}</td>
              <td className="px-1.5 py-2.5 text-right">{l.derrotas}</td>
              <td className="px-1.5 py-2.5 text-right">{l.golsPro}</td>
              <td className="px-1.5 py-2.5 text-right">{l.golsContra}</td>
              <td className="px-1.5 py-2.5 text-right">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
              <td className="py-2.5 pl-2 pr-4 text-right text-suave">{l.pontosFairPlay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha de partida (lista de rodadas)
// ---------------------------------------------------------------------------

export function LinhaPartida({ partida, campeonatoId }: { partida: PartidaJson; campeonatoId: string }) {
  const { mandante, visitante, placar, status, penaltis, vencedorId } = partida;
  const jogou = status !== 'AGENDADA';
  const peso = (id: string) => (vencedorId === id ? 'font-semibold' : vencedorId ? 'text-suave' : '');
  return (
    <Link
      to={`/campeonatos/${campeonatoId}/partidas/${partida.id}`}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 transition hover:bg-tinta/[0.03]"
    >
      <span className={`truncate text-right ${peso(mandante.id)}`}>{mandante.nome}</span>
      <span className="flex min-w-[88px] flex-col items-center">
        {jogou ? (
          <span
            className={`numeros rounded-md px-2.5 py-0.5 font-display text-xl font-bold ${
              status === 'EM_ANDAMENTO' ? 'bg-campo text-white' : 'bg-tinta text-papel'
            }`}
          >
            {placar.mandante} – {placar.visitante}
          </span>
        ) : (
          <span className="rounded-md border border-dashed border-linha px-3 py-0.5 text-xs font-medium uppercase text-suave">vs</span>
        )}
        {penaltis && (
          <span className="numeros mt-0.5 text-[11px] text-suave">
            pên. {penaltis.mandante}–{penaltis.visitante}
          </span>
        )}
        {status === 'EM_ANDAMENTO' && <span className="mt-0.5 text-[11px] font-semibold uppercase text-campo">ao vivo</span>}
      </span>
      <span className={`truncate ${peso(visitante.id)}`}>{visitante.nome}</span>
    </Link>
  );
}

/** Partidas de uma fase de pontos agrupadas por rodada. */
export function ListaDeRodadas({ fase, campeonatoId }: { fase: FaseJson; campeonatoId: string }) {
  const rodadas = [...new Set(fase.partidas.map((p) => p.rodada))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rodadas.map((r) => {
        const jogos = fase.partidas.filter((p) => p.rodada === r);
        const feitos = jogos.filter((p) => p.status === 'FINALIZADA').length;
        return (
          <div key={r} className="min-w-0 rounded-xl border border-linha bg-cartao">
            <div className="flex items-center justify-between border-b border-linha px-4 py-2">
              <span className="font-display text-base font-semibold uppercase tracking-wide">Rodada {r}</span>
              <span className="numeros text-xs text-suave">
                {feitos}/{jogos.length} jogos
              </span>
            </div>
            <div className="divide-y divide-linha/60">
              {jogos.map((p) => (
                <div key={p.id}>
                  {p.grupo && fase.grupos.length > 1 && (
                    <span className="block px-4 pt-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Grupo {p.grupo}</span>
                  )}
                  <LinhaPartida partida={p} campeonatoId={campeonatoId} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chaveamento do mata-mata
// ---------------------------------------------------------------------------

export function Chaveamento({ fases, campeonatoId, campeaoId }: { fases: FaseJson[]; campeonatoId: string; campeaoId: string | null }) {
  const eliminatorias = fases.filter((f) => f.tipo === 'MATA_MATA');
  if (!eliminatorias.length) return <Vazio>O chaveamento aparece quando o mata-mata começar.</Vazio>;

  // rodadas futuras ainda não geradas aparecem como colunas vazias
  const primeira = eliminatorias[0].partidas.length;
  const totalColunas = Math.log2(primeira) + 1;
  const colunas = Array.from({ length: totalColunas }, (_, i) => eliminatorias[i] ?? null);
  const nomeFutura = (jogos: number) => ({ 1: 'Final', 2: 'Semifinal', 4: 'Quartas de final', 8: 'Oitavas de final' })[jogos] ?? `Fase de ${jogos * 2}`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6 p-4">
        {colunas.map((fase, i) => {
          const jogos = primeira / 2 ** i;
          return (
            <div key={i} className="flex w-60 flex-col">
              <h4 className="mb-3 text-center font-display text-sm font-semibold uppercase tracking-wider text-suave">
                {fase?.nome ?? nomeFutura(jogos)}
              </h4>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {Array.from({ length: jogos }, (_, j) => {
                  const p = fase?.partidas.find((x) => x.posicao === j);
                  return p ? <CaixaChave key={j} partida={p} campeonatoId={campeonatoId} campeaoId={campeaoId} /> : <CaixaVazia key={j} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaixaChave({ partida, campeonatoId, campeaoId }: { partida: PartidaJson; campeonatoId: string; campeaoId: string | null }) {
  const linha = (lado: 'mandante' | 'visitante') => {
    const equipe = partida[lado];
    const venceu = partida.vencedorId === equipe.id;
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 ${venceu ? 'font-semibold' : partida.vencedorId ? 'text-suave' : ''}`}>
        <span className="truncate">
          {equipe.nome}
          {campeaoId === equipe.id && <span className="ml-1.5 text-amarelo" title="Campeão">★</span>}
        </span>
        <span className="numeros font-display text-lg font-bold">
          {partida.status === 'AGENDADA' ? '–' : partida.placar[lado]}
          {partida.penaltis && <sup className="ml-0.5 text-[10px] font-medium text-suave">({partida.penaltis[lado]})</sup>}
        </span>
      </div>
    );
  };
  return (
    <Link
      to={`/campeonatos/${campeonatoId}/partidas/${partida.id}`}
      className={`block divide-y divide-linha overflow-hidden rounded-lg border bg-cartao text-sm transition hover:border-campo ${
        partida.status === 'EM_ANDAMENTO' ? 'border-campo' : 'border-linha'
      }`}
    >
      {linha('mandante')}
      {linha('visitante')}
    </Link>
  );
}

function CaixaVazia() {
  return (
    <div className="divide-y divide-dashed divide-linha rounded-lg border border-dashed border-linha text-sm text-suave">
      <div className="px-3 py-2">A definir</div>
      <div className="px-3 py-2">A definir</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artilharia e suspensões
// ---------------------------------------------------------------------------

export function Artilharia({ linhas }: { linhas: LinhaArtilharia[] }) {
  if (!linhas.length) return <Vazio>Nenhum gol marcado ainda.</Vazio>;
  const max = linhas[0].gols;
  return (
    <ol className="divide-y divide-linha/60">
      {linhas.slice(0, 20).map((l, i) => (
        <li key={l.jogadorId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm">
          <span className="numeros text-suave">{i + 1}º</span>
          <span>
            <span className="font-medium">{l.nome}</span>
            <span className="block text-xs text-suave">{l.equipe}</span>
            <span className="mt-1 block h-1 rounded-full bg-campo/15">
              <span className="block h-1 rounded-full bg-campo" style={{ width: `${(l.gols / max) * 100}%` }} />
            </span>
          </span>
          <span className="numeros font-display text-xl font-bold">{l.gols}</span>
        </li>
      ))}
    </ol>
  );
}

export function Suspensoes({ suspensoes }: { suspensoes: SuspensaoJson[] }) {
  if (!suspensoes.length) return <Vazio>Nenhuma suspensão até agora.</Vazio>;
  const ordenadas = [...suspensoes].sort((a, b) => Number(b.ativa) - Number(a.ativa));
  return (
    <ul className="divide-y divide-linha/60">
      {ordenadas.map((s) => (
        <li key={s.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${s.ativa ? '' : 'opacity-60'}`}>
          <CartaoIcone cor={s.motivo === 'CARTAO_VERMELHO' ? 'vermelho' : 'amarelo'} />
          <span className="flex-1">
            <span className="font-medium">
              #{s.jogador.numero} {s.jogador.nome}
            </span>
            <span className="block text-xs text-suave">
              {s.equipe.nome} · {s.motivo === 'CARTAO_VERMELHO' ? 'cartão vermelho' : 'acúmulo de amarelos'}
            </span>
          </span>
          {s.ativa ? (
            <span className="rounded-full bg-vermelho/10 px-2.5 py-0.5 text-xs font-semibold text-vermelho">
              suspenso · {s.jogosRestantes} jogo{s.jogosRestantes > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs text-suave">cumprida</span>
          )}
        </li>
      ))}
    </ul>
  );
}
