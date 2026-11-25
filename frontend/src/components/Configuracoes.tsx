import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, linkDeAcesso, mensagemDeErro } from '../api/cliente';
import { chaves, useAcaoNoCampeonato } from '../api/hooks';
import { CampeonatoDetalhe, ModoInscricao, Regulamento, Visibilidade, pode } from '../api/tipos';
import { CamposDoRegulamento, SeletorDeAcesso, SeletorDeFormato } from './EditorRegulamento';
import { Aviso, Botao, BotaoCopiar, Campo, Painel } from './ui';

/** Configurações: dados e acesso (criador), regulamento (organizadores, só antes do início), exclusão. */
export function Configuracoes({ c }: { c: CampeonatoDetalhe }) {
  return (
    <div className="space-y-6">
      {pode(c, 'CONFIGURAR') && <DadosEAcesso c={c} />}
      {pode(c, 'CONFIGURAR') && <LinkDeAcesso c={c} />}
      {pode(c, 'EDITAR_REGULAMENTO') && <EditarRegulamento c={c} />}
      {pode(c, 'EXCLUIR') && <ZonaDePerigo c={c} />}
    </div>
  );
}

function DadosEAcesso({ c }: { c: CampeonatoDetalhe }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [dados, setDados] = useState({ nome: c.nome, descricao: c.descricao, modalidade: c.modalidade });
  const [acesso, setAcesso] = useState<{ visibilidade: Visibilidade; modoInscricao: ModoInscricao }>({
    visibilidade: c.visibilidade,
    modoInscricao: c.modoInscricao,
  });
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'info'; texto: string } | null>(null);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await acao.mutateAsync({ metodo: 'patch', caminho: '', corpo: { ...dados, ...acesso } });
      setMsg({ tipo: 'info', texto: 'Configurações salvas.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(err) });
    }
  };

  return (
    <Painel titulo="Dados e acesso">
      <form onSubmit={salvar} className="space-y-5 p-4">
        <Campo rotulo="Nome" required minLength={3} maxLength={100} value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Modalidade" maxLength={40} value={dados.modalidade} onChange={(e) => setDados({ ...dados, modalidade: e.target.value })} />
          <Campo rotulo="Descrição" maxLength={500} value={dados.descricao} onChange={(e) => setDados({ ...dados, descricao: e.target.value })} />
        </div>
        <SeletorDeAcesso visibilidade={acesso.visibilidade} modoInscricao={acesso.modoInscricao} aoMudar={setAcesso} />
        {c.status !== 'INSCRICOES_ABERTAS' && acesso.modoInscricao !== 'FECHADA' && (
          <p className="text-xs text-suave">O campeonato já começou: o modo de inscrição só vale enquanto as inscrições estão abertas.</p>
        )}
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <Botao type="submit" carregando={acao.isPending}>
          Salvar
        </Botao>
      </form>
    </Painel>
  );
}

function LinkDeAcesso({ c }: { c: CampeonatoDetalhe }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [erro, setErro] = useState<string | null>(null);
  if (!c.chaveDeAcesso) return null;
  const link = linkDeAcesso(c.id, c.chaveDeAcesso);
  return (
    <Painel titulo="Link de acesso">
      <div className="space-y-3 p-4 text-sm">
        <p className="text-suave">
          {c.visibilidade === 'PRIVADA'
            ? 'Quem abrir este link consegue ver o campeonato (e inscrever um time, se as inscrições estiverem abertas).'
            : 'O campeonato é público, então o link não é necessário. Ele passa a valer se você deixar o campeonato privado.'}
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-linha bg-papel px-2 py-1.5 text-xs">{link}</code>
          <BotaoCopiar texto={link} />
        </div>
        <Botao
          variante="secundario"
          className="!py-1.5 text-xs"
          carregando={acao.isPending}
          onClick={async () => {
            setErro(null);
            try {
              await acao.mutateAsync({ caminho: '/chave-de-acesso' });
            } catch (e) {
              setErro(mensagemDeErro(e));
            }
          }}
        >
          Gerar novo link (o antigo deixa de funcionar)
        </Botao>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Painel>
  );
}

function EditarRegulamento({ c }: { c: CampeonatoDetalhe }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [reg, setReg] = useState<Regulamento>(c.regulamento);
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'info'; texto: string } | null>(null);
  const travado = c.status !== 'INSCRICOES_ABERTAS';

  if (travado) {
    return (
      <Painel titulo="Regulamento">
        <p className="p-4 text-sm text-suave">O regulamento ficou travado quando o campeonato começou.</p>
      </Painel>
    );
  }

  const salvar = async () => {
    setMsg(null);
    try {
      await acao.mutateAsync({ metodo: 'patch', caminho: '/regulamento', corpo: reg });
      setMsg({ tipo: 'info', texto: 'Regulamento atualizado.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(err) });
    }
  };

  return (
    <Painel titulo="Regulamento">
      <div className="space-y-5 p-4">
        <p className="text-xs text-suave">Pode ser alterado até o campeonato começar. Depois disso, fica travado.</p>
        <SeletorDeFormato reg={reg} setReg={setReg} />
        <CamposDoRegulamento reg={reg} setReg={setReg} />
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <Botao onClick={salvar} carregando={acao.isPending}>
          Salvar regulamento
        </Botao>
      </div>
    </Painel>
  );
}

function ZonaDePerigo({ c }: { c: CampeonatoDetalhe }) {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const excluir = async () => {
    setErro(null);
    setEnviando(true);
    try {
      await api.delete(`/campeonatos/${c.id}`);
      qc.removeQueries({ queryKey: chaves.detalhe(c.id) });
      await qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
      navegar('/', { replace: true });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  };

  return (
    <Painel titulo="Excluir campeonato" className="border-vermelho/30">
      <div className="space-y-3 p-4 text-sm">
        <p>Apaga o campeonato com todas as equipes, partidas e súmulas. Não dá para desfazer.</p>
        <Campo rotulo={`Para confirmar, digite o nome: ${c.nome}`} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        {erro && <Aviso>{erro}</Aviso>}
        <Botao variante="perigo" disabled={confirmacao.trim() !== c.nome} carregando={enviando} onClick={excluir}>
          Excluir definitivamente
        </Botao>
      </div>
    </Painel>
  );
}
