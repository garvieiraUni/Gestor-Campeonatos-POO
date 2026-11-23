import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { mensagemDeErro } from '../api/cliente';
import { useAcaoNoCampeonato, useCampeonato } from '../api/hooks';
import { CampeonatoDetalhe } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { Artilharia, Chaveamento, ListaDeRodadas, Suspensoes, TabelaClassificacao } from '../components/Competicao';
import { GerenciarEquipes } from '../components/GerenciarEquipes';
import { Aviso, Botao, Carregando, Painel, ROTULO_FORMATO, SeloStatus, Vazio } from '../components/ui';

type Aba = 'classificacao' | 'rodadas' | 'chaveamento' | 'artilharia' | 'suspensoes' | 'equipes';

export function PainelCampeonato() {
  const { id = '' } = useParams();
  const { data: c, isLoading, error } = useCampeonato(id);
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();

  if (isLoading) return <Carregando />;
  if (error || !c) return <Aviso>{mensagemDeErro(error)}</Aviso>;

  const organizador = usuario?.id === c.organizadorId;
  const temPontos = c.formato !== 'MATA_MATA';
  const temChave = c.formato !== 'PONTOS_CORRIDOS';
  const abas: { id: Aba; nome: string; visivel: boolean }[] = [
    { id: 'classificacao', nome: 'Classificação', visivel: temPontos && c.status !== 'INSCRICOES_ABERTAS' },
    { id: 'rodadas', nome: 'Rodadas', visivel: temPontos && c.status !== 'INSCRICOES_ABERTAS' },
    { id: 'chaveamento', nome: 'Chaveamento', visivel: temChave && c.status !== 'INSCRICOES_ABERTAS' },
    { id: 'artilharia', nome: 'Artilharia', visivel: c.status !== 'INSCRICOES_ABERTAS' },
    { id: 'suspensoes', nome: `Suspensões${c.suspensoes.some((s) => s.ativa) ? ` (${c.suspensoes.filter((s) => s.ativa).length})` : ''}`, visivel: c.status !== 'INSCRICOES_ABERTAS' },
    { id: 'equipes', nome: `Equipes (${c.equipes.length})`, visivel: true },
  ];
  const visiveis = abas.filter((a) => a.visivel);
  const pedida = params.get('aba') as Aba | null;
  const aba = visiveis.find((a) => a.id === pedida)?.id ?? visiveis[0].id;

  return (
    <div>
      <Link to="/" className="text-sm text-suave hover:text-tinta">
        ← Campeonatos
      </Link>
      <Cabecalho c={c} organizador={organizador} />

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-linha" aria-label="Seções do campeonato">
        {visiveis.map((a) => (
          <button
            key={a.id}
            onClick={() => setParams({ aba: a.id }, { replace: true })}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              aba === a.id ? 'border-campo text-tinta' : 'border-transparent text-suave hover:text-tinta'
            }`}
          >
            {a.nome}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {aba === 'classificacao' && <AbaClassificacao c={c} />}
        {aba === 'rodadas' &&
          c.fases
            .filter((f) => f.tipo !== 'MATA_MATA')
            .map((f) => <ListaDeRodadas key={f.id} fase={f} campeonatoId={c.id} />)}
        {aba === 'chaveamento' && (
          <Painel titulo="Mata-mata">
            <Chaveamento fases={c.fases} campeonatoId={c.id} campeaoId={c.campeao?.id ?? null} />
          </Painel>
        )}
        {aba === 'artilharia' && (
          <Painel titulo="Artilharia">
            <Artilharia linhas={c.artilharia} />
          </Painel>
        )}
        {aba === 'suspensoes' && (
          <Painel titulo="Suspensões">
            <Suspensoes suspensoes={c.suspensoes} />
          </Painel>
        )}
        {aba === 'equipes' && <GerenciarEquipes campeonato={c} editavel={organizador && c.status === 'INSCRICOES_ABERTAS'} />}
      </div>
    </div>
  );
}

function Cabecalho({ c, organizador }: { c: CampeonatoDetalhe; organizador: boolean }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [erro, setErro] = useState<string | null>(null);
  const prontas = c.equipes.filter((e) => e.jogadores.length >= c.regulamento.minJogadores).length;

  const iniciar = async () => {
    setErro(null);
    try {
      await acao.mutateAsync({ caminho: '/iniciar' });
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <header className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-suave">
            <span>{c.modalidade}</span>
            <span>·</span>
            <span>{ROTULO_FORMATO[c.formato]}</span>
            <SeloStatus status={c.status} />
          </div>
          <h1 className="mt-1 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{c.nome}</h1>
          {c.descricao && <p className="mt-2 max-w-2xl text-sm text-suave">{c.descricao}</p>}
        </div>
        {organizador && c.status === 'INSCRICOES_ABERTAS' && (
          <div className="text-right">
            <Botao onClick={iniciar} carregando={acao.isPending}>
              Iniciar campeonato
            </Botao>
            <p className="numeros mt-1 text-xs text-suave">
              {prontas}/{c.equipes.length} equipes com elenco mínimo
            </p>
          </div>
        )}
      </div>

      {c.campeao && (
        <div className="mt-5 flex items-center gap-4 rounded-xl bg-tinta px-5 py-4 text-papel">
          <span className="text-3xl text-amarelo">★</span>
          <div>
            <p className="text-xs uppercase tracking-widest text-papel/60">Campeão</p>
            <p className="font-display text-3xl font-bold uppercase leading-none">{c.campeao.nome}</p>
          </div>
        </div>
      )}
      {c.status === 'EM_ANDAMENTO' && c.faseAtual && (
        <p className="mt-3 text-sm">
          Fase atual: <strong>{c.faseAtual}</strong> · <span className="numeros">{c.partidasJogadas}/{c.partidasTotais}</span> partidas jogadas
        </p>
      )}
      {erro && (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </header>
  );
}

function AbaClassificacao({ c }: { c: CampeonatoDetalhe }) {
  if (!c.tabelas.length) return <Vazio>A tabela aparece quando o campeonato começar.</Vazio>;
  const classificados = c.formato === 'GRUPOS_E_MATA_MATA' ? 2 : 1;
  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${c.tabelas.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {c.tabelas.map((t) => (
          <Painel key={`${t.faseId}-${t.grupo}`} titulo={c.tabelas.length > 1 ? `Grupo ${t.grupo}` : t.fase}>
            <TabelaClassificacao tabela={t} classificados={classificados} />
          </Painel>
        ))}
      </div>
      <p className="text-xs text-suave">
        P pontos · J jogos · V vitórias · E empates · D derrotas · GP gols pró · GC gols contra · SG saldo · FP pontos de cartão (amarelo 1, vermelho 3).
        {c.formato === 'GRUPOS_E_MATA_MATA' && ' Em verde, as posições que avançam ao mata-mata.'}
      </p>
    </div>
  );
}
