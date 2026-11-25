import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Campeonatos } from './pages/Campeonatos';
import { ConvitePorLink, MeusConvites } from './pages/Convites';
import { Entrar } from './pages/Entrar';
import { NovoCampeonato } from './pages/NovoCampeonato';
import { PainelCampeonato } from './pages/PainelCampeonato';
import { Sumula } from './pages/Sumula';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

/** Rota protegida: só contas logadas. */
function SoLogado({ children }: { children: React.ReactElement }) {
  const { usuario } = useAuth();
  const local = useLocation();
  return usuario ? children : <Navigate to="/entrar" state={{ de: local.pathname }} replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Campeonatos />} />
              <Route path="entrar" element={<Entrar />} />
              <Route path="novo" element={<SoLogado><NovoCampeonato /></SoLogado>} />
              <Route path="convites" element={<SoLogado><MeusConvites /></SoLogado>} />
              <Route path="convite/:token" element={<SoLogado><ConvitePorLink /></SoLogado>} />
              <Route path="campeonatos/:id" element={<PainelCampeonato />} />
              <Route path="campeonatos/:id/partidas/:partidaId" element={<Sumula />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
