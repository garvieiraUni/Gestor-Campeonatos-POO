import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { mensagemDeErro } from '../api/cliente';
import { useAcaoNoCampeonato } from '../api/hooks';
import { CampeonatoDetalhe, Equipe } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Botao, Campo, ROTULO_MODO, SeloInscricao } from './ui';

interface LinhaJogador {
  nome: string;
  numero: string;
  documento: string;
  posicao: string;
}

const vazia = (n: number): LinhaJogador => ({ nome: '', numero: String(n), documento: '', posicao: '' });

/**
 * Área do espectador no campeonato: inscrever o próprio time (com o elenco completo),
 * acompanhar a aprovação e, se recusado, ver o motivo e reenviar.
 */
export function InscricaoDoEspectador({ c }: { c: CampeonatoDetalhe }) {
  const { usuario } = useAuth();
  const local = useLocation();
  const minha = c.equipes.find((e) => e.id === c.minhaEquipeId);
  const [reenviando, setReenviando] = useState(false);

  if (c.status !== 'INSCRICOES_ABERTAS' && !minha) return null;

  if (c.meuBanimento) {
    return (
      <Aviso>
        Os organizadores impediram a sua conta de inscrever times neste campeonato{c.meuBanimento.motivo ? `: ${c.meuBanimento.motivo}` : '.'}
      </Aviso>
    );
  }

  if (minha) {
    return (
      <section className="rounded-xl border border-linha bg-cartao p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-suave">Seu time</p>
            <h3 className="font-display text-2xl font-bold uppercase">{minha.nome}</h3>
          </div>
          <SeloInscricao status={minha.status} />
        </div>
        {minha.status === 'PENDENTE' && <p className="mt-2 text-sm text-suave">Inscrição enviada. Agora é só esperar um organizador aprovar.</p>}
        {minha.status === 'APROVADA' && (
          <p className="mt-2 text-sm text-campo">Time confirmado no campeonato. Para mudar o elenco, fale com os organizadores.</p>
        )}
        {minha.status === 'RECUSADA' && (
          <div className="mt-3 space-y-3">
            <Aviso>
              <strong>Inscrição recusada.</strong> Motivo: {minha.motivoRecusa}
            </Aviso>
            {c.status === 'INSCRICOES_ABERTAS' &&
              (reenviando ? (
                <FormularioDeTime c={c} inicial={minha} caminho="/inscricao/reenviar" rotulo="Reenviar inscrição" aoConcluir={() => setReenviando(false)} />
              ) : (
                <Botao onClick={() => setReenviando(true)}>Corrigir e reenviar</Botao>
              ))}
          </div>
        )}
      </section>
    );
  }

  if (!c.podeInscreverTime) {
    if (!usuario && c.modoInscricao !== 'FECHADA') {
      return (
        <Aviso tipo="info">
          Este campeonato aceita inscrições ({ROTULO_MODO[c.modoInscricao].toLowerCase()}).{' '}
          <Link to="/entrar" state={{ de: local.pathname }} className="font-semibold underline">
            Entre na sua conta
          </Link>{' '}
          para inscrever o seu time.
        </Aviso>
      );
    }
    return null;
  }

  return (
    <section className="rounded-xl border border-campo/30 bg-campo-claro/40 p-5">
      <h3 className="font-display text-2xl font-bold uppercase">Inscrever meu time</h3>
      <p className="mt-1 text-sm text-suave">
        {c.modoInscricao === 'LIVRE' ? 'O time entra na hora.' : 'Um organizador vai analisar a inscrição.'} Envie o elenco completo: depois do envio, só os organizadores
        podem alterar.
      </p>
      <div className="mt-4">
        <FormularioDeTime c={c} caminho="/inscricao" rotulo="Enviar inscrição" />
      </div>
    </section>
  );
}

function FormularioDeTime({
  c,
  inicial,
  caminho,
  rotulo,
  aoConcluir,
}: {
  c: CampeonatoDetalhe;
  inicial?: Equipe;
  caminho: string;
  rotulo: string;
  aoConcluir?: () => void;
}) {
  const { minJogadores: min, maxJogadores: max } = c.regulamento;
  const acao = useAcaoNoCampeonato(c.id);
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [linhas, setLinhas] = useState<LinhaJogador[]>(() =>
    inicial?.jogadores.length
      ? inicial.jogadores.map((j) => ({ nome: j.nome, numero: String(j.numero), documento: j.documento ?? '', posicao: j.posicao ?? '' }))
      : Array.from({ length: min }, (_, i) => vazia(i + 1)),
  );
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (i: number, campo: keyof LinhaJogador, valor: string) =>
    setLinhas(linhas.map((l, k) => (k === i ? { ...l, [campo]: campo === 'numero' ? valor.replace(/\D/g, '') : valor } : l)));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await acao.mutateAsync({
        caminho,
        corpo: {
          nome,
          jogadores: linhas.map((l) => ({ nome: l.nome, numero: Number(l.numero), documento: l.documento, posicao: l.posicao || undefined })),
        },
      });
      aoConcluir?.();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo rotulo="Nome do time" required minLength={2} maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Elenco <span className="numeros text-suave">({linhas.length} de {min} a {max} jogadores)</span>
        </legend>
        <div className="space-y-2">
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className="col-span-2 min-w-0 rounded-md border border-linha bg-cartao px-2 py-1.5 text-sm" aria-label={`Número do jogador ${i + 1}`} inputMode="numeric" required value={l.numero} onChange={(e) => mudar(i, 'numero', e.target.value)} />
              <input className="col-span-10 min-w-0 rounded-md border border-linha bg-cartao px-2 py-1.5 text-sm sm:col-span-4" placeholder="Nome" aria-label={`Nome do jogador ${i + 1}`} required minLength={2} value={l.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} />
              <input className="col-span-6 min-w-0 rounded-md border border-linha bg-cartao px-2 py-1.5 text-sm sm:col-span-3" placeholder="Documento (RA)" aria-label={`Documento do jogador ${i + 1}`} required value={l.documento} onChange={(e) => mudar(i, 'documento', e.target.value)} />
              <input className="col-span-5 min-w-0 rounded-md border border-linha bg-cartao px-2 py-1.5 text-sm sm:col-span-2" placeholder="Posição" aria-label={`Posição do jogador ${i + 1}`} value={l.posicao} onChange={(e) => mudar(i, 'posicao', e.target.value)} />
              <button
                type="button"
                className="col-span-1 text-suave hover:text-vermelho disabled:opacity-30"
                disabled={linhas.length <= 1}
                onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}
                aria-label={`Remover jogador ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {linhas.length < max && (
          <button
            type="button"
            className="mt-2 rounded-full border border-dashed border-linha px-3 py-1 text-xs text-suave hover:border-campo hover:text-campo"
            onClick={() => setLinhas([...linhas, vazia(Math.max(0, ...linhas.map((l) => Number(l.numero) || 0)) + 1)])}
          >
            + Jogador
          </button>
        )}
      </fieldset>
      {erro && <Aviso>{erro}</Aviso>}
      <Botao type="submit" carregando={acao.isPending} disabled={linhas.length < min || linhas.length > max}>
        {rotulo}
      </Botao>
    </form>
  );
}
