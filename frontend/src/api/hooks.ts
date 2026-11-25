import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, guardarChaveDeAcesso } from './cliente';
import { CampeonatoDetalhe, CampeonatoResumo, ResumoDoConvite } from './tipos';

export const chaves = {
  lista: ['campeonatos'] as const,
  detalhe: (id: string) => ['campeonatos', id] as const,
  convites: ['convites'] as const,
};

export function useCampeonatos() {
  return useQuery({
    queryKey: chaves.lista,
    queryFn: async () => (await api.get<CampeonatoResumo[]>('/campeonatos')).data,
  });
}

/**
 * Detalhe do campeonato. Se a URL trouxer ?chave= (link de um campeonato privado),
 * a chave é guardada antes da primeira requisição e depois sai da barra de endereço.
 */
export function useCampeonato(id: string) {
  const [params, setParams] = useSearchParams();
  const chave = params.get('chave');
  if (chave) guardarChaveDeAcesso(id, chave);

  useEffect(() => {
    if (!chave) return;
    const resto = new URLSearchParams(params);
    resto.delete('chave');
    setParams(resto, { replace: true });
  }, [chave, params, setParams]);

  return useQuery({
    queryKey: chaves.detalhe(id),
    queryFn: async () => (await api.get<CampeonatoDetalhe>(`/campeonatos/${id}`)).data,
    retry: false,
  });
}

export function useMeusConvites(ativo: boolean) {
  return useQuery({
    queryKey: chaves.convites,
    queryFn: async () => (await api.get<ResumoDoConvite[]>('/convites')).data,
    enabled: ativo,
  });
}

type Metodo = 'post' | 'patch' | 'delete';

/**
 * Toda ação no campeonato devolve o campeonato atualizado.
 * Aqui colocamos esse retorno direto no cache, então a tela inteira se atualiza
 * (tabela, suspensões, chaveamento, permissões) sem precisar recarregar.
 */
export function useAcaoNoCampeonato(campeonatoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metodo = 'post', caminho, corpo }: { metodo?: Metodo; caminho: string; corpo?: unknown }) => {
      const url = `/campeonatos/${campeonatoId}${caminho}`;
      const r =
        metodo === 'delete'
          ? await api.delete<CampeonatoDetalhe>(url)
          : metodo === 'patch'
            ? await api.patch<CampeonatoDetalhe>(url, corpo ?? {})
            : await api.post<CampeonatoDetalhe>(url, corpo ?? {});
      return r.data;
    },
    onSuccess: (dados) => {
      if (dados) qc.setQueryData(chaves.detalhe(campeonatoId), dados);
      void qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
    },
    onError: (erro: { response?: { status?: number } }) => {
      // 409: outra pessoa alterou o campeonato; recarrega para mostrar a versão atual
      if (erro.response?.status === 409) void qc.invalidateQueries({ queryKey: chaves.detalhe(campeonatoId) });
    },
  });
}
