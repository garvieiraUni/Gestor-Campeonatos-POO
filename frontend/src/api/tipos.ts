// Tipos do JSON devolvido pela API (espelham o CampeonatoApresentador do backend).

export type Status = 'INSCRICOES_ABERTAS' | 'EM_ANDAMENTO' | 'ENCERRADO';
export type Formato = 'PONTOS_CORRIDOS' | 'MATA_MATA' | 'GRUPOS_E_MATA_MATA';
export type StatusPartida = 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA';
export type TipoEvento = 'GOL' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO';
export type Criterio = 'PONTOS' | 'VITORIAS' | 'SALDO_DE_GOLS' | 'GOLS_PRO' | 'CONFRONTO_DIRETO' | 'FAIR_PLAY';

export interface EquipeRef {
  id: string;
  nome: string;
}

export interface Regulamento {
  formato: Formato;
  minJogadores: number;
  maxJogadores: number;
  pontosVitoria: number;
  pontosEmpate: number;
  pontosDerrota: number;
  criteriosDesempate: Criterio[];
  idaEVolta: boolean;
  numeroGrupos: number;
  amarelosParaSuspensao: number;
  jogosSuspensaoVermelho: number;
}

export interface CampeonatoResumo {
  id: string;
  nome: string;
  modalidade: string;
  descricao: string;
  status: Status;
  formato: Formato;
  organizadorId: string;
  quantidadeDeEquipes: number;
  partidasJogadas: number;
  partidasTotais: number;
  faseAtual: string | null;
  campeao: EquipeRef | null;
  criadoEm: string;
}

export interface Jogador {
  id: string;
  nome: string;
  numero: number;
  documento: string;
  posicao: string | null;
}

export interface Equipe {
  id: string;
  nome: string;
  jogadores: Jogador[];
}

export interface EventoJson {
  id: string;
  tipo: TipoEvento;
  minuto: number;
  equipeId: string;
  segundoAmarelo: boolean;
  jogador: { id: string; nome: string; numero: number };
}

export interface PartidaJson {
  id: string;
  faseId: string;
  fase: string;
  rodada: number;
  grupo: string | null;
  posicao: number;
  eliminatoria: boolean;
  status: StatusPartida;
  mandante: EquipeRef;
  visitante: EquipeRef;
  placar: { mandante: number; visitante: number };
  penaltis: { mandante: number; visitante: number } | null;
  vencedorId: string | null;
  suspensos: string[];
  eventos: EventoJson[];
}

export interface FaseJson {
  id: string;
  nome: string;
  tipo: 'PONTOS_CORRIDOS' | 'GRUPOS' | 'MATA_MATA';
  ordem: number;
  completa: boolean;
  grupos: { nome: string; equipeIds: string[] }[];
  partidas: PartidaJson[];
}

export interface LinhaTabela {
  posicao: number;
  equipeId: string;
  nome: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
  pontos: number;
  pontosFairPlay: number;
}

export interface Tabela {
  faseId: string;
  fase: string;
  grupo: string;
  linhas: LinhaTabela[];
}

export interface LinhaArtilharia {
  jogadorId: string;
  nome: string;
  equipeId: string;
  equipe: string;
  gols: number;
}

export interface SuspensaoJson {
  id: string;
  jogador: { id: string; nome: string; numero: number };
  equipe: EquipeRef;
  motivo: 'ACUMULO_DE_AMARELOS' | 'CARTAO_VERMELHO';
  jogos: number;
  jogosRestantes: number;
  ativa: boolean;
  partidaOrigemId: string;
}

export interface CampeonatoDetalhe extends CampeonatoResumo {
  regulamento: Regulamento;
  faseAtualId: string | null;
  equipes: Equipe[];
  fases: FaseJson[];
  tabelas: Tabela[];
  artilharia: LinhaArtilharia[];
  suspensoes: SuspensaoJson[];
}

export interface Sessao {
  token: string;
  usuario: { id: string; nome: string; email: string };
}
