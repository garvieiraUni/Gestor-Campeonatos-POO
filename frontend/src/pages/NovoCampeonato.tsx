import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/cliente';
import { chaves } from '../api/hooks';
import { CampeonatoDetalhe, ModoInscricao, Regulamento, Visibilidade } from '../api/tipos';
import { CamposDoRegulamento, ROTULO_CRITERIO, SeletorDeAcesso, SeletorDeFormato } from '../components/EditorRegulamento';
import { Aviso, Botao, Campo, ROTULO_FORMATO, ROTULO_MODO, ROTULO_VISIBILIDADE } from '../components/ui';

const PASSOS = ['Dados e formato', 'Regras e desempate', 'Acesso e inscrições', 'Revisão'];

export function NovoCampeonato() {
  const navegar = useNavegarParaCampeonato();
  const [passo, setPasso] = useState(0);
  const [dados, setDados] = useState({ nome: '', modalidade: 'Futebol', descricao: '' });
  const [acesso, setAcesso] = useState<{ visibilidade: Visibilidade; modoInscricao: ModoInscricao }>({
    visibilidade: 'PUBLICA',
    modoInscricao: 'FECHADA',
  });
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
  const ultimo = PASSOS.length - 1;

  const criar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const { data } = await api.post<CampeonatoDetalhe>('/campeonatos', { ...dados, ...acesso, regulamento: reg });
      navegar(data);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  };

  const podeAvancar = passo === 0 ? dados.nome.trim().length >= 3 : passo === 1 ? reg.maxJogadores >= reg.minJogadores : true;

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
            <SeletorDeFormato reg={reg} setReg={setReg} />
          </>
        )}

        {passo === 1 && <CamposDoRegulamento reg={reg} setReg={setReg} />}

        {passo === 2 && (
          <>
            <SeletorDeAcesso visibilidade={acesso.visibilidade} modoInscricao={acesso.modoInscricao} aoMudar={setAcesso} />
            <p className="text-xs text-suave">Você pode mudar a visibilidade e o modo de inscrição depois, a qualquer momento.</p>
          </>
        )}

        {passo === 3 && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Item termo="Nome" valor={dados.nome} />
            <Item termo="Modalidade" valor={dados.modalidade} />
            <Item termo="Formato" valor={`${ROTULO_FORMATO[reg.formato]}${reg.formato === 'GRUPOS_E_MATA_MATA' ? ` · ${reg.numeroGrupos} grupos` : ''}`} />
            <Item termo="Elenco" valor={`${reg.minJogadores} a ${reg.maxJogadores} jogadores`} />
            <Item termo="Pontuação" valor={`V ${reg.pontosVitoria} · E ${reg.pontosEmpate} · D ${reg.pontosDerrota}`} />
            <Item termo="Suspensões" valor={`${reg.amarelosParaSuspensao} amarelos = 1 jogo · vermelho = ${reg.jogosSuspensaoVermelho} jogo(s)`} />
            <Item termo="Visibilidade" valor={ROTULO_VISIBILIDADE[acesso.visibilidade]} />
            <Item termo="Inscrição" valor={ROTULO_MODO[acesso.modoInscricao]} />
            <div className="sm:col-span-2">
              <Item termo="Desempate" valor={reg.criteriosDesempate.map((c) => ROTULO_CRITERIO[c]).join(' → ')} />
            </div>
            <p className="text-xs text-suave sm:col-span-2">
              Depois de criar, você inscreve as equipes, pode convidar outros organizadores e inicia o campeonato. O regulamento só pode ser alterado até o início.
            </p>
          </dl>
        )}

        {erro && <Aviso>{erro}</Aviso>}

        <div className="flex justify-between border-t border-linha pt-4">
          <Botao variante="secundario" onClick={() => setPasso(passo - 1)} disabled={passo === 0}>
            Voltar
          </Botao>
          {passo < ultimo ? (
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
