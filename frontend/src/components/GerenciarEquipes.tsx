import { FormEvent, useState } from 'react';
import { useAcaoNoCampeonato } from '../api/hooks';
import { mensagemDeErro } from '../api/cliente';
import { CampeonatoDetalhe, Equipe } from '../api/tipos';
import { Aviso, Botao, Campo, Vazio } from './ui';

/** Lista as equipes; com `editavel`, permite inscrever equipes e montar elencos. */
export function GerenciarEquipes({ campeonato, editavel }: { campeonato: CampeonatoDetalhe; editavel: boolean }) {
  const acao = useAcaoNoCampeonato(campeonato.id);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const { minJogadores, maxJogadores } = campeonato.regulamento;
  // pendentes e recusadas ficam na aba "Inscrições"
  const aprovadas = campeonato.equipes.filter((e) => e.status === 'APROVADA');

  const inscrever = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await acao.mutateAsync({ caminho: '/equipes', corpo: { nome } });
      setNome('');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  return (
    <div className="space-y-4">
      {editavel && (
        <form onSubmit={inscrever} className="flex flex-col gap-3 rounded-xl border border-linha bg-cartao p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Campo rotulo="Inscrever nova equipe" placeholder="Nome da equipe" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
          </div>
          <Botao type="submit" carregando={acao.isPending && !!nome}>
            Inscrever
          </Botao>
        </form>
      )}
      {erro && <Aviso>{erro}</Aviso>}
      {!aprovadas.length && <Vazio>Nenhuma equipe confirmada ainda.</Vazio>}
      <div className="grid gap-4 md:grid-cols-2">
        {aprovadas.map((eq) => (
          <CartaoEquipe key={eq.id} equipe={eq} campeonatoId={campeonato.id} editavel={editavel} min={minJogadores} max={maxJogadores} />
        ))}
      </div>
    </div>
  );
}

function CartaoEquipe({ equipe, campeonatoId, editavel, min, max }: { equipe: Equipe; campeonatoId: string; editavel: boolean; min: number; max: number }) {
  const acao = useAcaoNoCampeonato(campeonatoId);
  const proximoNumero = (() => {
    const usados = new Set(equipe.jogadores.map((j) => j.numero));
    let n = 1;
    while (usados.has(n)) n++;
    return n;
  })();
  const [form, setForm] = useState({ nome: '', numero: '', documento: '', posicao: '' });
  const [erro, setErro] = useState<string | null>(null);
  const completa = equipe.jogadores.length >= min;

  const executar = async (fn: () => Promise<unknown>) => {
    setErro(null);
    try {
      await fn();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  const adicionar = (e: FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      await acao.mutateAsync({
        caminho: `/equipes/${equipe.id}/jogadores`,
        corpo: { nome: form.nome, numero: Number(form.numero || proximoNumero), documento: form.documento, posicao: form.posicao || undefined },
      });
      setForm({ nome: '', numero: '', documento: '', posicao: '' });
    });
  };

  return (
    <article className="rounded-xl border border-linha bg-cartao">
      <header className="flex items-center justify-between gap-2 border-b border-linha px-4 py-3">
        <div>
          <h4 className="font-display text-lg font-semibold uppercase tracking-wide">{equipe.nome}</h4>
          {equipe.responsavel && <p className="text-xs text-suave">Inscrito por {equipe.responsavel.nome}</p>}
          <p className={`numeros text-xs ${completa ? 'text-campo' : 'text-[#9a6b00]'}`}>
            {equipe.jogadores.length}/{max} jogadores {completa ? '· elenco mínimo atingido' : `· faltam ${min - equipe.jogadores.length} para o mínimo`}
          </p>
        </div>
        {editavel && (
          <Botao variante="fantasma" className="!px-2 text-xs" onClick={() => void executar(() => acao.mutateAsync({ metodo: 'delete', caminho: `/equipes/${equipe.id}` }))}>
            Remover
          </Botao>
        )}
      </header>
      <ul className="max-h-64 divide-y divide-linha/60 overflow-y-auto text-sm">
        {equipe.jogadores.map((j) => (
          <li key={j.id} className="flex items-center gap-3 px-4 py-2">
            <span className="numeros w-7 text-right font-display text-base font-bold text-suave">{j.numero}</span>
            <span className="flex-1">
              {j.nome}
              {j.posicao && <span className="ml-2 text-xs text-suave">{j.posicao}</span>}
              {j.documento && <span className="ml-2 text-xs text-suave/70">· {j.documento}</span>}
            </span>
            {editavel && (
              <button
                className="text-xs text-suave hover:text-vermelho"
                onClick={() => void executar(() => acao.mutateAsync({ metodo: 'delete', caminho: `/equipes/${equipe.id}/jogadores/${j.id}` }))}
                aria-label={`Remover ${j.nome}`}
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {!equipe.jogadores.length && <li className="px-4 py-4 text-center text-xs text-suave">Sem jogadores.</li>}
      </ul>
      {editavel && equipe.jogadores.length < max && (
        <form onSubmit={adicionar} className="grid grid-cols-12 gap-2 border-t border-linha p-3">
          <input
            className="col-span-3 sm:col-span-2 w-full min-w-0 rounded-md border border-linha bg-papel px-2 py-1.5 text-sm"
            placeholder={String(proximoNumero)}
            inputMode="numeric"
            aria-label="Número"
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value.replace(/\D/g, '') })}
          />
          <input className="col-span-9 sm:col-span-10 w-full min-w-0 rounded-md border border-linha bg-papel px-2 py-1.5 text-sm" placeholder="Nome do jogador" required minLength={2} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="col-span-6 sm:col-span-5 w-full min-w-0 rounded-md border border-linha bg-papel px-2 py-1.5 text-sm" placeholder="Documento (RA)" required value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
          <input className="col-span-6 sm:col-span-4 w-full min-w-0 rounded-md border border-linha bg-papel px-2 py-1.5 text-sm" placeholder="Posição" value={form.posicao} onChange={(e) => setForm({ ...form, posicao: e.target.value })} />
          <Botao type="submit" className="col-span-12 !py-1.5 sm:col-span-3">
            Adicionar
          </Botao>
        </form>
      )}
      {erro && (
        <div className="px-3 pb-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </article>
  );
}
