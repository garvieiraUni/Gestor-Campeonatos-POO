import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mensagemDeErro } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Botao, Campo } from '../components/ui';

export function Entrar() {
  const { entrar, registrar } = useAuth();
  const navegar = useNavigate();
  const destino = (useLocation().state as { de?: string } | null)?.de ?? '/';
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (modo === 'login') await entrar(form.email, form.senha);
      else await registrar(form.nome, form.email, form.senha);
      navegar(destino, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl font-bold uppercase">{modo === 'login' ? 'Entrar' : 'Criar conta'}</h1>
      <p className="mt-1 text-sm text-suave">Organizadores entram para criar campeonatos e preencher súmulas. Visitantes acompanham sem login.</p>

      <form onSubmit={enviar} className="mt-6 space-y-4 rounded-xl border border-linha bg-cartao p-6">
        {modo === 'cadastro' && <Campo rotulo="Nome" required minLength={2} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />}
        <Campo rotulo="E-mail" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Campo
          rotulo="Senha"
          type="password"
          required
          minLength={6}
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" className="w-full" carregando={enviando}>
          {modo === 'login' ? 'Entrar' : 'Criar conta'}
        </Botao>
        <button type="button" onClick={() => setModo(modo === 'login' ? 'cadastro' : 'login')} className="w-full text-center text-sm text-campo hover:underline">
          {modo === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tenho conta'}
        </button>
      </form>

      {modo === 'login' && (
        <Aviso tipo="info">
          Conta de demonstração: <strong>demo@campeonatos.dev</strong> / <strong>demo123</strong>{' '}
          <button className="ml-1 underline" onClick={() => setForm({ ...form, email: 'demo@campeonatos.dev', senha: 'demo123' })}>
            preencher
          </button>
        </Aviso>
      )}
    </div>
  );
}
