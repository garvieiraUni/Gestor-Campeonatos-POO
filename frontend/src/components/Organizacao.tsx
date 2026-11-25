import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensagemDeErro } from '../api/cliente';
import { useAcaoNoCampeonato } from '../api/hooks';
import { CampeonatoDetalhe, pode } from '../api/tipos';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Botao, BotaoCopiar, Campo, Painel } from './ui';

const linkDoConvite = (token: string) => `${window.location.origin}/convite/${encodeURIComponent(token)}`;

/** Quem organiza o campeonato, convites ativos e o modal de convidar. */
export function Organizacao({ c }: { c: CampeonatoDetalhe }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const acao = useAcaoNoCampeonato(c.id);
  const [convidando, setConvidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const gerencia = pode(c, 'GERENCIAR_ORGANIZADORES');
  const souConvidado = c.meuPapel === 'ORGANIZADOR';

  const executar = async (fn: () => Promise<unknown>) => {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <div className="space-y-6">
      <Painel
        titulo="Organizadores"
        acao={
          gerencia && (
            <Botao className="!py-1.5" onClick={() => setConvidando(true)}>
              + Convidar
            </Botao>
          )
        }
      >
        <ul className="divide-y divide-linha text-sm">
          <li className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 font-medium">{c.criador.nome}</span>
            <span className="rounded-full bg-campo/10 px-2.5 py-0.5 text-xs font-semibold text-campo">Criador</span>
          </li>
          {c.organizadores.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1">
                {o.nome}
                {o.id === usuario?.id && <span className="ml-2 text-xs text-suave">(você)</span>}
              </span>
              {gerencia && (
                <Botao variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => void executar(() => acao.mutateAsync({ metodo: 'delete', caminho: `/organizadores/${o.id}` }))}>
                  Remover
                </Botao>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-linha px-4 py-2 text-xs text-suave">
          Organizadores inscrevem e aprovam times, preenchem a súmula, alteram o regulamento antes do início e banem contas. Só o criador mexe nas configurações e na equipe de organização.
        </p>
      </Painel>

      {gerencia && c.convites.length > 0 && (
        <Painel titulo="Convites ativos">
          <ul className="divide-y divide-linha text-sm">
            {c.convites.map((cv) => (
              <li key={cv.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  {cv.tipo === 'EMAIL' ? (
                    <>
                      Convite para <strong>{cv.email}</strong> <span className="text-xs text-suave">· aguardando resposta</span>
                    </>
                  ) : (
                    <>
                      Link de convite <span className="text-xs text-suave">· vale para qualquer conta até ser revogado</span>
                      <code className="mt-1 block truncate text-xs text-suave">{linkDoConvite(cv.token!)}</code>
                    </>
                  )}
                </span>
                {cv.tipo === 'LINK' && <BotaoCopiar texto={linkDoConvite(cv.token!)} rotulo="Copiar link" />}
                <Botao variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => void executar(() => acao.mutateAsync({ metodo: 'delete', caminho: `/convites/${cv.id}` }))}>
                  Revogar
                </Botao>
              </li>
            ))}
          </ul>
        </Painel>
      )}

      {souConvidado && (
        <Botao
          variante="perigo"
          onClick={() =>
            void executar(async () => {
              await acao.mutateAsync({ caminho: '/organizadores/sair' });
              // num campeonato privado, quem sai pode perder o acesso
              navegar(c.visibilidade === 'PRIVADA' ? '/' : `/campeonatos/${c.id}`);
            })
          }
        >
          Sair da organização
        </Botao>
      )}

      {erro && <Aviso>{erro}</Aviso>}
      {convidando && <ModalDeConvite c={c} aoFechar={() => setConvidando(false)} />}
    </div>
  );
}

/** "Convidar organizador": por e-mail de uma conta existente ou gerando um link. */
function ModalDeConvite({ c, aoFechar }: { c: CampeonatoDetalhe; aoFechar: () => void }) {
  const acao = useAcaoNoCampeonato(c.id);
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const convidar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await acao.mutateAsync({ caminho: '/convites', corpo: { email } });
      setFeito(`Convite enviado para ${email}. A pessoa vê o convite em "Convites" quando entrar.`);
      setEmail('');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  const gerarLink = async () => {
    setErro(null);
    try {
      const dados = await acao.mutateAsync({ caminho: '/convites/link' });
      const novo = dados.convites.filter((x) => x.tipo === 'LINK').at(-1);
      if (novo?.token) setLink(linkDoConvite(novo.token));
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-convite" onClick={aoFechar}>
      <div className="w-full max-w-lg space-y-5 rounded-xl bg-cartao p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 id="titulo-convite" className="font-display text-2xl font-bold uppercase">
            Convidar organizador
          </h2>
          <button className="text-suave hover:text-tinta" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={convidar} className="space-y-3">
          <Campo rotulo="Por e-mail" dica="A conta precisa já estar cadastrada no site." type="email" required placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Botao type="submit" carregando={acao.isPending && !!email}>
            Enviar convite
          </Botao>
        </form>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-suave">
          <span className="h-px flex-1 bg-linha" /> ou <span className="h-px flex-1 bg-linha" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Por link</p>
          <p className="text-xs text-suave">Qualquer conta logada que abrir o link vira organizadora. Você pode revogar o link depois.</p>
          {link ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-linha bg-papel px-2 py-1.5 text-xs">{link}</code>
              <BotaoCopiar texto={link} />
            </div>
          ) : (
            <Botao variante="secundario" onClick={gerarLink} carregando={acao.isPending && !email}>
              Gerar link de convite
            </Botao>
          )}
        </div>

        {feito && <Aviso tipo="info">{feito}</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </div>
  );
}
