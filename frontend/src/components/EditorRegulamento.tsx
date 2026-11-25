import { Criterio, Formato, ModoInscricao, Regulamento, Visibilidade } from '../api/tipos';
import { Aviso, Campo, DESCRICAO_MODO, DESCRICAO_VISIBILIDADE, ROTULO_FORMATO, ROTULO_MODO, ROTULO_VISIBILIDADE, Selecao } from './ui';

export const ROTULO_CRITERIO: Record<Criterio, string> = {
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

interface Props {
  reg: Regulamento;
  setReg: (r: Regulamento) => void;
}

/** Cartões de escolha (rádio estilizado) usados nos seletores abaixo. */
function Opcoes<T extends string>({
  nome,
  valor,
  opcoes,
  rotulo,
  descricao,
  aoMudar,
  colunas = 3,
}: {
  nome: string;
  valor: T;
  opcoes: T[];
  rotulo: Record<T, string>;
  descricao: Record<T, string>;
  aoMudar: (v: T) => void;
  colunas?: 2 | 3;
}) {
  return (
    <div className={`grid gap-3 ${colunas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {opcoes.map((o) => (
        <label
          key={o}
          className={`cursor-pointer rounded-lg border p-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-campo/30 ${valor === o ? 'border-campo bg-campo-claro' : 'border-linha hover:border-tinta/30'}`}
        >
          <input type="radio" className="sr-only" name={nome} checked={valor === o} onChange={() => aoMudar(o)} />
          <span className="block font-semibold">{rotulo[o]}</span>
          <span className="mt-1 block text-xs text-suave">{descricao[o]}</span>
        </label>
      ))}
    </div>
  );
}

export function SeletorDeFormato({ reg, setReg }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Formato</legend>
      <Opcoes
        nome="formato"
        valor={reg.formato}
        opcoes={Object.keys(ROTULO_FORMATO) as Formato[]}
        rotulo={ROTULO_FORMATO}
        descricao={DESCRICAO_FORMATO}
        aoMudar={(formato) => setReg({ ...reg, formato })}
      />
    </fieldset>
  );
}

/** Visibilidade e modo de inscrição, com o aviso de "privado com inscrições abertas". */
export function SeletorDeAcesso({
  visibilidade,
  modoInscricao,
  aoMudar,
}: {
  visibilidade: Visibilidade;
  modoInscricao: ModoInscricao;
  aoMudar: (v: { visibilidade: Visibilidade; modoInscricao: ModoInscricao }) => void;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Visibilidade</legend>
        <Opcoes
          nome="visibilidade"
          colunas={2}
          valor={visibilidade}
          opcoes={['PUBLICA', 'PRIVADA']}
          rotulo={ROTULO_VISIBILIDADE}
          descricao={DESCRICAO_VISIBILIDADE}
          aoMudar={(v) => aoMudar({ visibilidade: v, modoInscricao })}
        />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Inscrição de times</legend>
        <Opcoes
          nome="modoInscricao"
          valor={modoInscricao}
          opcoes={['LIVRE', 'COM_APROVACAO', 'FECHADA']}
          rotulo={ROTULO_MODO}
          descricao={DESCRICAO_MODO}
          aoMudar={(m) => aoMudar({ visibilidade, modoInscricao: m })}
        />
      </fieldset>
      {visibilidade === 'PRIVADA' && modoInscricao !== 'FECHADA' && (
        <Aviso tipo="info">
          Atenção: o campeonato é privado, mas aceita inscrições de espectadores. Só quem tiver o link de acesso vai conseguir encontrar o campeonato e inscrever um time.
        </Aviso>
      )}
    </div>
  );
}

/** Elenco, pontuação, suspensões, turnos, grupos e critérios de desempate. */
export function CamposDoRegulamento({ reg, setReg }: Props) {
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

  return (
    <div className="space-y-5">
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
    </div>
  );
}
