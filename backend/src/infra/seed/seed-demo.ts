import { GeradorDeHash } from '../../application/portas/portas';
import {
  Campeonato,
  CampeonatoRepository,
  Partida,
  RegulamentoProps,
  TipoModoInscricao,
  TipoVisibilidade,
  Usuario,
  UsuarioRepository,
} from '../../domain';

/** Contas de demonstração (valores de teste, documentados no README). */
export const EMAIL_DEMO = 'demo@campeonatos.dev';
export const SENHA_DEMO = 'demo123';
export const EMAIL_ADM = 'adm@campeonatos.dev';
export const SENHA_ADM = 'adm123';
export const EMAIL_ESPECTADOR = 'torcedor@campeonatos.dev';
export const SENHA_ESPECTADOR = 'torcedor123';

/** Gerador pseudoaleatório com semente: os dados de demo saem sempre iguais. */
function aleatorio(semente: number) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES = ['Lucas', 'Gabriel', 'Rafael', 'Pedro', 'Mateus', 'Gustavo', 'Felipe', 'Bruno', 'Thiago', 'Diego', 'Caio', 'Vinícius', 'Arthur', 'Enzo', 'Davi', 'Henrique', 'João', 'Leonardo', 'Murilo', 'Samuel'];
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Moreira', 'Teixeira'];
const POSICOES = ['Goleiro', 'Fixo', 'Ala', 'Ala', 'Pivô', 'Ala', 'Fixo', 'Pivô', 'Ala', 'Goleiro'];

function montar(
  criadorId: string,
  dados: { nome: string; modalidade: string; descricao: string; regulamento: Partial<RegulamentoProps>; visibilidade?: TipoVisibilidade; modoInscricao?: TipoModoInscricao },
  equipes: string[],
  jogadoresPorEquipe: number,
  rnd: () => number,
): Campeonato {
  const c = Campeonato.criar({ ...dados, criadorId });
  let doc = 1000;
  equipes.forEach((nome) => {
    const e = c.inscreverEquipe(nome);
    for (let n = 1; n <= jogadoresPorEquipe; n++) {
      const nomeJogador = `${NOMES[Math.floor(rnd() * NOMES.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]}`;
      c.adicionarJogador(e.id, { nome: nomeJogador, numero: n, documento: `RA${doc++}`, posicao: POSICOES[(n - 1) % POSICOES.length] });
    }
  });
  return c;
}

/** Joga uma partida com gols aleatórios e alguns cartões, respeitando suspensões. */
function simular(c: Campeonato, p: Partida, rnd: () => number, cartoesExtras: { jogadorId: string; tipo: 'CARTAO_AMARELO' }[] = []) {
  c.iniciarPartida(p.id);
  const aptos = (equipeId: string) => c.obterEquipe(equipeId).jogadores.filter((j) => !c.estaSuspenso(j.id, p.id));
  for (const equipeId of [p.mandanteId, p.visitanteId]) {
    const gols = Math.floor(rnd() * 4);
    for (let g = 0; g < gols; g++) {
      const linha = aptos(equipeId).slice(1); // goleiro (camisa 1) raramente marca
      const autor = linha[Math.floor(rnd() * linha.length)];
      c.registrarEvento(p.id, { tipo: 'GOL', jogadorId: autor.id, minuto: 1 + Math.floor(rnd() * 39) });
    }
    if (rnd() < 0.35) {
      const lista = aptos(equipeId).slice(2);
      const autor = lista[Math.floor(rnd() * lista.length)];
      if (!p.foiExpulso(autor.id) && p.amarelosDo(autor.id) === 0) {
        c.registrarEvento(p.id, { tipo: 'CARTAO_AMARELO', jogadorId: autor.id, minuto: 1 + Math.floor(rnd() * 39) });
      }
    }
  }
  for (const x of cartoesExtras) {
    if (!p.foiExpulso(x.jogadorId)) c.registrarEvento(p.id, { tipo: x.tipo, jogadorId: x.jogadorId, minuto: 30 });
  }
  const placar = p.placar();
  const penaltis = p.eliminatoria && placar.mandante === placar.visitante ? { mandante: 4, visitante: 3 } : null;
  c.finalizarPartida(p.id, penaltis);
}

/**
 * Popula o sistema com dados de demonstração:
 *  1. Copa em grupos + mata-mata, rodadas 1 e 2 jogadas (bom para a demo ao vivo)
 *  2. Liga em pontos corridos com inscrições abertas (5 equipes → uma folga por rodada)
 *  3. Torneio mata-mata já encerrado (mostra chaveamento e campeão)
 *  4. Racha privado com inscrição livre (mostra o link de acesso e o aviso de privado + inscrições abertas)
 * e três contas: o organizador, um ADM e um torcedor (espectador) com convite e inscrição pendentes.
 */
export async function semearDemo(campeonatos: CampeonatoRepository, usuarios: UsuarioRepository, hash: GeradorDeHash): Promise<boolean> {
  if (await usuarios.buscarPorEmail(EMAIL_DEMO)) return false;
  const rnd = aleatorio(2026);

  const org = Usuario.criar('Organizador Demo', EMAIL_DEMO, await hash.gerar(SENHA_DEMO));
  const adm = Usuario.criar('Administrador do Site', EMAIL_ADM, await hash.gerar(SENHA_ADM));
  adm.promoverAAdministrador();
  const torcedor = Usuario.criar('Torcedor Demo', EMAIL_ESPECTADOR, await hash.gerar(SENHA_ESPECTADOR));
  for (const u of [org, adm, torcedor]) await usuarios.salvar(u);

  // 1) Copa com fase de grupos em andamento
  const copa = montar(
    org.id,
    {
      nome: 'Copa Interclasses 2026',
      modalidade: 'Futsal',
      descricao: 'Fase de grupos com 2 grupos de 4; os dois melhores de cada grupo vão às semifinais.',
      regulamento: { formato: 'GRUPOS_E_MATA_MATA', numeroGrupos: 2, minJogadores: 5, maxJogadores: 12 },
    },
    ['Atlético Vila Nova', 'Leões do Norte', 'Unidos da Serra', 'Real Paulista', 'Tubarões FC', 'Estrela do Vale', 'Fênix EC', 'Guerreiros da Leste'],
    8,
    rnd,
  );
  copa.iniciar();
  // um jogador leva amarelo nas rodadas 1 e 2 → aparece suspenso na rodada 3
  const visado = copa.equipes[0].jogadores[3];
  for (const rodada of [1, 2]) {
    for (const p of copa.faseAtual!.partidas.filter((x) => x.rodada === rodada)) {
      simular(copa, p, rnd, p.envolve(copa.equipes[0].id) ? [{ jogadorId: visado.id, tipo: 'CARTAO_AMARELO' }] : []);
    }
  }
  // o torcedor foi convidado para ajudar a organizar (aparece em "Meus convites")
  copa.convidarPorEmail({ id: torcedor.id, email: torcedor.email }, org.id);
  await campeonatos.salvar(copa);

  // 2) Liga com inscrições abertas, que dependem de aprovação
  const liga = montar(
    org.id,
    {
      nome: 'Liga de Society da Universidade',
      modalidade: 'Society',
      descricao: 'Pontos corridos em turno único. Qualquer conta pode inscrever um time; os organizadores aprovam.',
      regulamento: { formato: 'PONTOS_CORRIDOS', minJogadores: 7, maxJogadores: 14 },
      modoInscricao: 'COM_APROVACAO',
    },
    ['Computação FC', 'Engenharia United', 'Matemática EC', 'Física Atlética', 'Biomédicas FC'],
    9,
    rnd,
  );
  // o torcedor inscreveu o próprio time e espera a aprovação
  liga.solicitarInscricao(torcedor.id, {
    nome: 'Direito da Bola',
    jogadores: Array.from({ length: 8 }, (_, i) => ({
      nome: `${NOMES[(i * 3) % NOMES.length]} ${SOBRENOMES[(i * 5) % SOBRENOMES.length]}`,
      numero: i + 1,
      documento: `RA${9000 + i}`,
      posicao: POSICOES[i % POSICOES.length],
    })),
  });
  await campeonatos.salvar(liga);

  // 4) Racha privado: só quem tem o link vê; qualquer um com o link inscreve o time na hora
  const racha = montar(
    org.id,
    {
      nome: 'Racha dos Amigos de Quinta',
      modalidade: 'Futsal',
      descricao: 'Campeonato fechado do grupo de quinta à noite. Peça o link para quem organiza.',
      regulamento: { formato: 'MATA_MATA', minJogadores: 5, maxJogadores: 10 },
      visibilidade: 'PRIVADA',
      modoInscricao: 'LIVRE',
    },
    ['Os Cansados', 'Sem Goleiro FC', 'Pelada Pura'],
    6,
    rnd,
  );
  await campeonatos.salvar(racha);

  // 3) Torneio mata-mata encerrado
  const relampago = montar(
    org.id,
    {
      nome: 'Torneio Relâmpago de Férias',
      modalidade: 'Futebol 7',
      descricao: 'Mata-mata com 8 equipes, jogo único e pênaltis em caso de empate.',
      regulamento: { formato: 'MATA_MATA', minJogadores: 7, maxJogadores: 12 },
    },
    ['Panteras', 'Falcões', 'Lobos da Serra', 'Corsários', 'Titãs', 'Dragões', 'Furacão', 'Vikings'],
    9,
    rnd,
  );
  relampago.iniciar();
  while (relampago.status === 'EM_ANDAMENTO') {
    for (const p of relampago.faseAtual!.partidas.filter((x) => !x.finalizada)) simular(relampago, p, rnd);
  }
  await campeonatos.salvar(relampago);
  return true;
}
