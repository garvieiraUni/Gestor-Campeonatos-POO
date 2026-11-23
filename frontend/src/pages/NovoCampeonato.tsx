import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/cliente';
import { chaves } from '../api/hooks';
import { CampeonatoDetalhe, Criterio, Formato, Regulamento } from '../api/tipos';
import { Aviso, Botao, Campo, ROTULO_FORMATO, Selecao } from '../components/ui';

const ROTULO_CRITERIO: Record<Criterio, string> = {
  PONTOS: 'Pontos',
  VITORIAS: 'Número de vitórias',
  SALDO_DE_GOLS: 'Saldo de gols',
  GOLS_PRO: 'Gols marcados',
  CONFRONTO_DIRETO: 'Confronto direto',
  FAIR_PLAY: 'Fair play (menos cartões)',
};
const TODOS: Criterio[] = ['PONTOS', 'VITORIAS', 'SALDO_DE_GOLS', 'GOLS_PRO', 'CONFRONTO_DIRETO', 'FAIR_PLAY'];

const DESCRICAO_FORMATO: Record<Formato, string> = {
  PONTOS_CORRIDOS: 'Todos jogam contra todos. Campeão é quem soma mais pontos.',
  MATA_MATA: 'Eliminação direta em jogo único, com pênaltis em caso de empate. Exige 2, 4, 8, 16 ou 32 equipes.',
  GRUPOS_E_MATA_MATA: 'Grupos em pontos corridos; os 2 melhores de cada grupo avançam ao mata-mata cruzado (1º A × 2º B).',
};

const PASSOS = ['Dados e formato', 'Regras e desempate', 'Revisão'];

export function NovoCampeonato() {
  const navegar = useNavegarParaCampeonato();
  const [passo, setPasso] = useState(0);
  const [dados, setDados] = useState({ nome: '', modalidade: 'Futebol', descricao: '' });
  const [reg, setReg] = useState<Regulamento>({
    formato: 'PONTOS_CORRIDOS',
    minJogadores: 5,
    maxJogadores: 15,
    pontosVitoria: 3,
    pontosEmpate: 1,
    pontosDerrota: 0,
    criteriosDesempate: ['PONTOS', 'VITORIAS', 'SALDO_DE_GOLS', 'GOLS_PRO', 'CONFRONTO_DIRETO', 'FAIR_PLAY'],
    idaEVolta: false,
    numeroGrupos: 2,
    amarelosParaSuspensao: 2,
    jogosSuspensaoVermelho: 1,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const num = (campo: keyof Regulamento) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setReg({ ...reg, [campo]: Number(e.target.value) });

  const mover = (i: number, delta: number) => {
    const lista = [...reg.criteriosDesempate];
    const j = i + delta;
    if (j < 1 || j >= lista.length) return; // PONTOS fica sempre em 1º
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setReg({ ...reg, criteriosDesempate: lista });
  };
  const alternar = (c: Criterio) =>
    setReg({
      ...reg,
      criteriosDesempate: reg.criteriosDesempate.includes(c) ? reg.criteriosDesempate.filter((x) => x !== c) : [...reg.criteriosDesempate, c],
    });

  const criar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const { data } = await api.post<CampeonatoDetalhe>('/campeonatos', { ...dados, regulamento: reg });
      navegar(data);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  };

  const podeAvancar = passo === 0 ? dados.nome.trim().length >= 3 : reg.maxJogadores >= reg.minJogadores;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl font-bold uppercase">Novo campeonato</h1>

      <ol className="mt-6 flex gap-2">
        {PASSOS.map((nome, i) => (
          <li key={nome} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= passo ? 'bg-campo' : 'bg-linha'}`} />
            <span className={`mt-1.5 block text-xs font-medium ${i === passo ? 'text-tinta' : 'text-suave'}`}>
              {i + 1}. {nome}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-5 rounded-xl border border-linha bg-cartao p-6">
        {passo === 0 && (
          <>
            <Campo rotulo="Nome do campeonato" required value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} placeholder="Ex.: Copa de Futsal 2026" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Modalidade" value={dados.modalidade} onChange={(e) => setDados({ ...dados, modalidade: e.target.value })} placeholder="Futsal, Society…" />
              <Campo rotulo="Descrição (opcional)" value={dados.descricao} onChange={(e) => setDados({ ...dados, descricao: e.target.value })} />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Formato</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(ROTULO_FORMATO) as Formato[]).map((f) => (
                  <label
                    key={f}
                    className={`cursor-pointer rounded-lg border p-3 text-sm transition ${reg.formato === f ? 'border-campo bg-campo-claro' : 'border-linha hover:border-tinta/30'}`}
                  >
                    <input type="radio" className="sr-only" name="formato" checked={reg.formato === f} onChange={() => setReg({ ...reg, formato: f })} />
                    <span className="block font-semibold">{ROTULO_FORMATO[f]}</span>
                    <span className="mt-1 block text-xs text-suave">{DESCRICAO_FORMATO[f]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {passo === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Mínimo de jogadores por equipe" type="number" min={1} max={50} value={reg.minJogadores} onChange={num('minJogadores')} />
              <Campo rotulo="Máximo de jogadores por equipe" type="number" min={1} max={50} value={reg.maxJogadores} onChange={num('maxJogadores')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Pontos por vitória" type="number" min={0} max={10} value={reg.pontosVitoria} onChange={num('pontosVitoria')} />
              <Campo rotulo="Pontos por empate" type="number" min={0} max={10} value={reg.pontosEmpate} onChange={num('pontosEmpate')} />
              <Campo rotulo="Pontos por derrota" type="number" min={0} max={10} value={reg.pontosDerrota} onChange={num('pontosDerrota')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Amarelos para suspensão" type="number" min={2} max={10} value={reg.amarelosParaSuspensao} onChange={num('amarelosParaSuspensao')} />
              <Campo rotulo="Jogos de suspensão por vermelho" type="number" min={1} max={10} value={reg.jogosSuspensaoVermelho} onChange={num('jogosSuspensaoVermelho')} />
            </div>
            {reg.formato !== 'MATA_MATA' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Selecao rotulo="Turnos" value={reg.idaEVolta ? '2' : '1'} onChange={(e) => setReg({ ...reg, idaEVolta: e.target.value === '2' })}>
                  <option value="1">Turno único</option>
                  <option value="2">Ida e volta</option>
                </Selecao>
                {reg.formato === 'GRUPOS_E_MATA_MATA' && (
                  <Selecao rotulo="Número de grupos" value={reg.numeroGrupos} onChange={num('numeroGrupos')}>
                    <option value={2}>2 grupos (semifinal)</option>
                    <option value={4}>4 grupos (quartas)</option>
                    <option value={8}>8 grupos (oitavas)</option>
                  </Selecao>
                )}
              </div>
            )}
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Critérios de classificação (em ordem)</legend>
              <p className="mb-3 text-xs text-suave">Aplicados em sequência até separar as equipes. Pontos é sempre o primeiro.</p>
              <ol className="space-y-2">
                {reg.criteriosDesempate.map((c, i) => (
                  <li key={c} className="flex items-center gap-2 rounded-lg border border-linha bg-papel px-3 py-2 text-sm">
                    <span className="numeros w-5 font-display font-bold text-suave">{i + 1}</span>
                    <span className="flex-1 font-medium">{ROTULO_CRITERIO[c]}</span>
                    {i > 0 && (
                      <>
                        <button type="button" onClick={() => mover(i, -1)} disabled={i === 1} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30" aria-label="Subir">↑</button>
                        <button type="button" onClick={() => mover(i, 1)} disabled={i === reg.criteriosDesempate.length - 1} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30" aria-label="Descer">↓</button>
                        <button type="button" onClick={() => alternar(c)} className="px-1.5 text-suave hover:text-vermelho" aria-label="Remover">✕</button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap gap-2">
                {TODOS.filter((c) => !reg.criteriosDesempate.includes(c)).map((c) => (
                  <button key={c} type="button" onClick={() => alternar(c)} className="rounded-full border border-dashed border-linha px-3 py-1 text-xs text-suave hover:border-campo hover:text-campo">
                    + {ROTULO_CRITERIO[c]}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {passo === 2 && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Item termo="Nome" valor={dados.nome} />
            <Item termo="Modalidade" valor={dados.modalidade} />
            <Item termo="Formato" valor={`${ROTULO_FORMATO[reg.formato]}${reg.formato === 'GRUPOS_E_MATA_MATA' ? ` · ${reg.numeroGrupos} grupos` : ''}`} />
            <Item termo="Elenco" valor={`${reg.minJogadores} a ${reg.maxJogadores} jogadores`} />
            <Item termo="Pontuação" valor={`V ${reg.pontosVitoria} · E ${reg.pontosEmpate} · D ${reg.pontosDerrota}`} />
            <Item termo="Suspensões" valor={`${reg.amarelosParaSuspensao} amarelos = 1 jogo · vermelho = ${reg.jogosSuspensaoVermelho} jogo(s)`} />
            <div className="sm:col-span-2">
              <Item termo="Desempate" valor={reg.criteriosDesempate.map((c) => ROTULO_CRITERIO[c]).join(' → ')} />
            </div>
            <p className="text-xs text-suave sm:col-span-2">Depois de criar, você inscreve as equipes e os jogadores e inicia o campeonato.</p>
          </dl>
        )}

        {erro && <Aviso>{erro}</Aviso>}

        <div className="flex justify-between border-t border-linha pt-4">
          <Botao variante="secundario" onClick={() => setPasso(passo - 1)} disabled={passo === 0}>
            Voltar
          </Botao>
          {passo < 2 ? (
            <Botao onClick={() => setPasso(passo + 1)} disabled={!podeAvancar}>
              Continuar
            </Botao>
          ) : (
            <Botao onClick={criar} carregando={enviando}>
              Criar campeonato
            </Botao>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-suave">{termo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function useNavegarParaCampeonato() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  return (c: CampeonatoDetalhe) => {
    qc.setQueryData(chaves.detalhe(c.id), c);
    void qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
    navegar(`/campeonatos/${c.id}?aba=equipes`);
  };
}
