import axios, { AxiosError } from 'axios';

const CHAVE_SESSAO = 'gestor-campeonatos:sessao';
const CHAVES_DE_ACESSO = 'gestor-campeonatos:chaves';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

// injeta o token JWT e, para campeonatos privados, a chave do link de acesso
api.interceptors.request.use((config) => {
  const sessao = lerSessaoSalva();
  if (sessao) config.headers.Authorization = `Bearer ${sessao.token}`;
  const id = config.url?.match(/^\/campeonatos\/([0-9a-f-]{36})/)?.[1];
  const chave = id ? chaveDeAcessoDe(id) : null;
  if (chave) config.headers['X-Chave-Acesso'] = chave;
  return config;
});

export function lerSessaoSalva(): { token: string; usuario: { id: string; nome: string; email: string; papel: 'ADM' | 'PADRAO' } } | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(valor: unknown | null): void {
  try {
    if (valor) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* navegador sem armazenamento: a sessão dura só enquanto a aba estiver aberta */
  }
}

// ---------- chaves de acesso de campeonatos privados ----------
// Guardadas por campeonato, para o link continuar valendo depois que o ?chave= sai da URL.

const chavesEmMemoria: Record<string, string> = {};

function lerChaves(): Record<string, string> {
  try {
    return { ...JSON.parse(localStorage.getItem(CHAVES_DE_ACESSO) ?? '{}'), ...chavesEmMemoria };
  } catch {
    return { ...chavesEmMemoria };
  }
}

export function guardarChaveDeAcesso(campeonatoId: string, chave: string): void {
  chavesEmMemoria[campeonatoId] = chave;
  try {
    localStorage.setItem(CHAVES_DE_ACESSO, JSON.stringify({ ...lerChaves(), [campeonatoId]: chave }));
  } catch {
    /* fica só em memória */
  }
}

export function chaveDeAcessoDe(campeonatoId: string): string | null {
  return lerChaves()[campeonatoId] ?? null;
}

/** Link de acesso de um campeonato privado (o organizador copia e compartilha). */
export function linkDeAcesso(campeonatoId: string, chave: string): string {
  return `${window.location.origin}/campeonatos/${campeonatoId}?chave=${encodeURIComponent(chave)}`;
}

/** Extrai a mensagem amigável que o backend devolve em { mensagem }. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof AxiosError) {
    const msg = (erro.response?.data as { mensagem?: string } | undefined)?.mensagem;
    if (msg) return msg;
    if (!erro.response) return 'Não foi possível falar com o servidor. O backend está rodando?';
  }
  return 'Algo deu errado. Tente novamente.';
}
