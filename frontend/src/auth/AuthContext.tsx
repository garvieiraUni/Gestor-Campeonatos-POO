import { createContext, ReactNode, useContext, useState } from 'react';
import { api, lerSessaoSalva, salvarSessao } from '../api/cliente';
import { Sessao } from '../api/tipos';

interface ContextoAuth {
  usuario: Sessao['usuario'] | null;
  entrar(email: string, senha: string): Promise<void>;
  registrar(nome: string, email: string, senha: string): Promise<void>;
  sair(): void;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessaoSalva());

  const guardar = (s: Sessao | null) => {
    salvarSessao(s);
    setSessao(s);
  };

  const valor: ContextoAuth = {
    usuario: sessao?.usuario ?? null,
    async entrar(email, senha) {
      guardar((await api.post<Sessao>('/auth/login', { email, senha })).data);
    },
    async registrar(nome, email, senha) {
      guardar((await api.post<Sessao>('/auth/registrar', { nome, email, senha })).data);
    },
    sair() {
      guardar(null);
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return c;
}
