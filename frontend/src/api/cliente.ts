import axios, { AxiosError } from 'axios';

const CHAVE_SESSAO = 'gestor-campeonatos:sessao';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

// injeta o token JWT em toda requisição
api.interceptors.request.use((config) => {
  const sessao = lerSessaoSalva();
  if (sessao) config.headers.Authorization = `Bearer ${sessao.token}`;
  return config;
});

export function lerSessaoSalva(): { token: string; usuario: { id: string; nome: string; email: string } } | null {
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

/** Extrai a mensagem amigável que o backend devolve em { mensagem }. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof AxiosError) {
    const msg = (erro.response?.data as { mensagem?: string } | undefined)?.mensagem;
    if (msg) return msg;
    if (!erro.response) return 'Não foi possível falar com o servidor. O backend está rodando?';
  }
  return 'Algo deu errado. Tente novamente.';
}
