import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './cliente';
import { CampeonatoDetalhe, CampeonatoResumo } from './tipos';

export const chaves = {
  lista: ['campeonatos'] as const,
  detalhe: (id: string) => ['campeonatos', id] as const,
};

export function useCampeonatos() {
  return useQuery({
    queryKey: chaves.lista,
    queryFn: async () => (await api.get<CampeonatoResumo[]>('/campeonatos')).data,
  });
}

export function useCampeonato(id: string) {
  return useQuery({
    queryKey: chaves.detalhe(id),
    queryFn: async () => (await api.get<CampeonatoDetalhe>(`/campeonatos/${id}`)).data,
  });
}

type Metodo = 'post' | 'delete';

/**
 * Toda ação do organizador devolve o campeonato atualizado.
 * Aqui colocamos esse retorno direto no cache, então a tela inteira se atualiza
 * (tabela, suspensões, chaveamento) sem precisar recarregar.
 */
export function useAcaoNoCampeonato(campeonatoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metodo = 'post', caminho, corpo }: { metodo?: Metodo; caminho: string; corpo?: unknown }) => {
      const url = `/campeonatos/${campeonatoId}${caminho}`;
      const r = metodo === 'delete' ? await api.delete<CampeonatoDetalhe>(url) : await api.post<CampeonatoDetalhe>(url, corpo ?? {});
      return r.data;
    },
    onSuccess: (dados) => {
      qc.setQueryData(chaves.detalhe(campeonatoId), dados);
      void qc.invalidateQueries({ queryKey: chaves.lista, exact: true });
    },
  });
}
