import { NaoEncontradoError, RegraDeNegocioError, garantir } from '../compartilhado/erros';
import { Id, novoId } from '../compartilhado/id';
import { ModoDeInscricao, TipoModoInscricao } from '../configuracao/modo-inscricao';
import { ChaveDeAcesso, TipoVisibilidade, Visibilidade } from '../configuracao/visibilidade';
import { LinhaTabela } from '../desempate/linha-tabela';
import { AvancoDeFase, ControleDisciplinar, ObservadorDePartida } from '../disciplina/observadores';
import { Suspensao, SuspensaoSnapshot } from '../disciplina/suspensao';
import { EventoPartida, TipoEvento } from '../eventos/evento-partida';
import { FormatoFactory } from '../formatos/formato-factory';
import { ContextoFormato, FormatoTorneio } from '../formatos/formato-torneio';
import { Banimento, BanimentoSnapshot, NivelBanimento } from '../organizacao/banimento';
import { ContaConvidada, Convite, ConviteFactory, ConvitePorEmail, ConvitePorLink, ConviteSnapshot } from '../organizacao/convite';
import { Equipe, EquipeSnapshot } from './equipe';
import { EstadoCampeonato, StatusCampeonato } from './estado-campeonato';
import { Fase, FaseSnapshot } from './fase';
import { Jogador } from './jogador';
import { Partida, Placar } from './partida';
import { Regulamento, RegulamentoProps } from './regulamento';

export const MAXIMO_DE_EQUIPES = 32;

export interface CampeonatoSnapshot {
  id: Id;
  nome: string;
  descricao: string;
  modalidade: string;
  criadorId: Id;
  /** Organizadores convidados (o criador não entra nesta lista). */
  organizadores: Id[];
  status: StatusCampeonato;
  visibilidade: TipoVisibilidade;
  modoInscricao: TipoModoInscricao;
  chaveAcesso: string;
  regulamento: RegulamentoProps;
  equipes: EquipeSnapshot[];
  fases: FaseSnapshot[];
  suspensoes: SuspensaoSnapshot[];
  convites: ConviteSnapshot[];
  banimentos: BanimentoSnapshot[];
  campeaoId: Id | null;
  criadoEm: string;
  /** Lock otimista: 0 = ainda não foi salvo. */
  versao: number;
}

export interface LinhaArtilharia {
  jogadorId: Id;
  nome: string;
  equipeId: Id;
  equipe: string;
  gols: number;
}

export interface DadosDoJogador {
  nome: string;
  numero: number;
  documento: string;
  posicao?: string | null;
}

export interface DadosDaInscricao {
  nome: string;
  jogadores: DadosDoJogador[];
}

/**
 * Raiz do agregado. Toda alteração em equipes, partidas, suspensões e organização passa por aqui,
 * o que garante que nenhuma regra de negócio seja pulada.
 *
 * O Campeonato NÃO decide quem pode fazer cada coisa: isso é da PoliticaDeAcesso.
 * Aqui ficam só as regras do esporte e da inscrição.
 */
export class Campeonato {
  readonly id: Id;
  readonly criadorId: Id;
  readonly criadoEm: Date;
  private _nome!: string;
  private _descricao!: string;
  private _modalidade!: string;
  private _regulamento: Regulamento;
  private estado: EstadoCampeonato;
  private _visibilidade: Visibilidade;
  private _modoInscricao: ModoDeInscricao;
  private _chaveDeAcesso: ChaveDeAcesso;
  private readonly _organizadores: Id[];
  private readonly _equipes: Equipe[];
  private readonly _fases: Fase[];
  private readonly _suspensoes: Suspensao[];
  private readonly _convites: Convite[];
  private _banimentos: Banimento[];
  private _campeaoId: Id | null;
  private _versao: number;
  private readonly observadores: ObservadorDePartida[];

  private constructor(s: CampeonatoSnapshot, observadores?: ObservadorDePartida[]) {
    this.id = s.id;
    this.criadorId = s.criadorId;
    this.criadoEm = new Date(s.criadoEm);
    this.definirDadosBasicos(s.nome, s.descricao, s.modalidade);
    this._regulamento = Regulamento.criar(s.regulamento);
    this.estado = EstadoCampeonato.de(s.status);
    this._visibilidade = Visibilidade.de(s.visibilidade ?? 'PUBLICA');
    this._modoInscricao = ModoDeInscricao.de(s.modoInscricao ?? 'FECHADA');
    this._chaveDeAcesso = s.chaveAcesso ? ChaveDeAcesso.de(s.chaveAcesso) : ChaveDeAcesso.gerar();
    this._organizadores = [...(s.organizadores ?? [])];
    this._equipes = s.equipes.map(Equipe.restaurar);
    this._fases = s.fases.map(Fase.restaurar).sort((a, b) => a.ordem - b.ordem);
    this._suspensoes = s.suspensoes.map(Suspensao.restaurar);
    this._convites = (s.convites ?? []).map(ConviteFactory.restaurar);
    this._banimentos = (s.banimentos ?? []).map(Banimento.restaurar);
    this._campeaoId = s.campeaoId;
    this._versao = s.versao ?? 0;
    // a ordem importa: primeiro suspensões, depois avanço de fase
    this.observadores = observadores ?? [new ControleDisciplinar(), new AvancoDeFase()];
  }

  static criar(dados: {
    nome: string;
    criadorId: Id;
    descricao?: string;
    modalidade?: string;
    regulamento?: Partial<RegulamentoProps>;
    visibilidade?: TipoVisibilidade;
    modoInscricao?: TipoModoInscricao;
  }): Campeonato {
    return new Campeonato({
      id: novoId(),
      nome: dados.nome,
      descricao: dados.descricao ?? '',
      modalidade: dados.modalidade ?? 'Futebol',
      criadorId: dados.criadorId,
      organizadores: [],
      status: 'INSCRICOES_ABERTAS',
      visibilidade: dados.visibilidade ?? 'PUBLICA',
      modoInscricao: dados.modoInscricao ?? 'FECHADA',
      chaveAcesso: ChaveDeAcesso.gerar().valor,
      regulamento: Regulamento.criar(dados.regulamento).snapshot(),
      equipes: [],
      fases: [],
      suspensoes: [],
      convites: [],
      banimentos: [],
      campeaoId: null,
      criadoEm: new Date().toISOString(),
      versao: 0,
    });
  }

  static restaurar(s: CampeonatoSnapshot): Campeonato {
    return new Campeonato(s);
  }

  // ---------- leitura ----------

  get nome(): string {
    return this._nome;
  }
  get descricao(): string {
    return this._descricao;
  }
  get modalidade(): string {
    return this._modalidade;
  }
  get regulamento(): Regulamento {
    return this._regulamento;
  }
  get status(): StatusCampeonato {
    return this.estado.status;
  }
  get visibilidade(): Visibilidade {
    return this._visibilidade;
  }
  get modoInscricao(): ModoDeInscricao {
    return this._modoInscricao;
  }
  get chaveDeAcesso(): ChaveDeAcesso {
    return this._chaveDeAcesso;
  }
  get organizadores(): readonly Id[] {
    return this._organizadores;
  }
  /** Todas as equipes, inclusive pendentes e recusadas. */
  get equipes(): readonly Equipe[] {
    return this._equipes;
  }
  /** As que de fato disputam o campeonato. */
  get equipesAprovadas(): Equipe[] {
    return this._equipes.filter((e) => e.aprovada);
  }
  get inscricoesPendentes(): Equipe[] {
    return this._equipes.filter((e) => e.pendente);
  }
  get fases(): readonly Fase[] {
    return this._fases;
  }
  get suspensoes(): readonly Suspensao[] {
    return this._suspensoes;
  }
  get convites(): readonly Convite[] {
    return this._convites;
  }
  get convitesAtivos(): Convite[] {
    return this._convites.filter((c) => c.ativo);
  }
  get banimentos(): readonly Banimento[] {
    return this._banimentos;
  }
  get campeaoId(): Id | null {
    return this._campeaoId;
  }
  get versao(): number {
    return this._versao;
  }
  get faseAtual(): Fase | undefined {
    return this._fases[this._fases.length - 1];
  }
  get formato(): FormatoTorneio {
    return FormatoFactory.criar(this.regulamento.formato);
  }

  ehCriador(usuarioId: Id): boolean {
    return this.criadorId === usuarioId;
  }

  ehOrganizadorConvidado(usuarioId: Id): boolean {
    return this._organizadores.includes(usuarioId);
  }

  /** Criador ou organizador convidado. */
  fazParteDaOrganizacao(usuarioId: Id): boolean {
    return this.ehCriador(usuarioId) || this.ehOrganizadorConvidado(usuarioId);
  }

  /** Organiza ou tem um time inscrito (pendente ou aprovado): enxerga mesmo se o campeonato for privado. */
  participa(usuarioId: Id): boolean {
    return this.fazParteDaOrganizacao(usuarioId) || this._equipes.some((e) => e.ehDe(usuarioId) && !e.recusada);
  }

  equipeDoResponsavel(usuarioId: Id): Equipe | undefined {
    return this._equipes.find((e) => e.ehDe(usuarioId));
  }

  banimentoDe(usuarioId: Id): Banimento | undefined {
    return this._banimentos.find((b) => b.usuarioId === usuarioId);
  }

  estaBanidoDeVer(usuarioId: Id): boolean {
    return this.banimentoDe(usuarioId)?.impedeVisualizacao() ?? false;
  }

  estaBanidoDeInscrever(usuarioId: Id): boolean {
    return this.banimentoDe(usuarioId)?.impedeInscricao() ?? false;
  }

  obterEquipe(equipeId: Id): Equipe {
    const e = this._equipes.find((x) => x.id === equipeId);
    if (!e) throw new NaoEncontradoError('Equipe não encontrada neste campeonato');
    return e;
  }

  equipeDoJogador(jogadorId: Id): Equipe | undefined {
    return this._equipes.find((e) => e.possuiJogador(jogadorId));
  }

  obterPartida(partidaId: Id): Partida {
    for (const f of this._fases) {
      const p = f.buscarPartida(partidaId);
      if (p) return p;
    }
    throw new NaoEncontradoError('Partida não encontrada neste campeonato');
  }

  todasAsPartidas(): Partida[] {
    return this._fases.flatMap((f) => [...f.partidas]);
  }

  /** Avisos para os organizadores sobre combinações de configuração que costumam confundir. */
  avisosDeConfiguracao(): string[] {
    const avisos: string[] = [];
    if (!this._visibilidade.apareceNaListaPublica() && this._modoInscricao.aceitaInscricaoDeEspectador()) {
      avisos.push(
        'Este campeonato é privado, mas aceita inscrições de espectadores: só quem tiver o link de acesso conseguirá inscrever um time.',
      );
    }
    return avisos;
  }

  // ---------- configuração ----------

  alterarDadosBasicos(dados: { nome?: string; descricao?: string; modalidade?: string }): void {
    this.definirDadosBasicos(dados.nome ?? this._nome, dados.descricao ?? this._descricao, dados.modalidade ?? this._modalidade);
  }

  /** Visibilidade e modo de inscrição podem mudar a qualquer momento. */
  alterarVisibilidade(tipo: TipoVisibilidade): void {
    this._visibilidade = Visibilidade.de(tipo);
  }

  alterarModoInscricao(tipo: TipoModoInscricao): void {
    this._modoInscricao = ModoDeInscricao.de(tipo);
  }

  /** Invalida todos os links de acesso já compartilhados. */
  regenerarChaveDeAcesso(): void {
    this._chaveDeAcesso = ChaveDeAcesso.gerar();
  }

  /**
   * R18: o regulamento só muda antes do início. O Value Object não é alterado:
   * um novo Regulamento, validado do zero, substitui o anterior.
   */
  alterarRegulamento(parcial: Partial<RegulamentoProps>): void {
    this.estado.garantirInscricoesAbertas();
    const novo = Regulamento.criar({ ...this._regulamento.snapshot(), ...parcial });
    for (const e of this._equipes) {
      if (e.jogadores.length > novo.props.maxJogadores) {
        throw new RegraDeNegocioError(
          `A equipe ${e.nome} tem ${e.jogadores.length} jogadores, acima do novo máximo de ${novo.props.maxJogadores}`,
        );
      }
    }
    this._regulamento = novo;
  }

  private definirDadosBasicos(nome: string, descricao: string, modalidade: string): void {
    const n = nome?.trim();
    garantir(n && n.length >= 3, 'O nome do campeonato precisa ter pelo menos 3 caracteres');
    this._nome = n;
    this._descricao = descricao?.trim() ?? '';
    this._modalidade = modalidade?.trim() || 'Futebol';
  }

  // ---------- inscrições pelos organizadores (R1, R2, R3) ----------

  inscreverEquipe(nome: string): Equipe {
    this.estado.garantirInscricoesAbertas();
    const equipe = Equipe.criar(nome);
    this.garantirQueCabe(equipe.nome);
    this._equipes.push(equipe);
    return equipe;
  }

  removerEquipe(equipeId: Id): void {
    this.estado.garantirInscricoesAbertas();
    const equipe = this.obterEquipe(equipeId);
    this._equipes.splice(this._equipes.indexOf(equipe), 1);
  }

  adicionarJogador(equipeId: Id, dados: DadosDoJogador): Jogador {
    this.estado.garantirInscricoesAbertas();
    const equipe = this.obterEquipe(equipeId);
    const jogador = Jogador.criar(dados);
    this.garantirDocumentoLivre(jogador.documento);
    equipe.adicionarJogador(jogador, this.regulamento.props.maxJogadores);
    return jogador;
  }

  removerJogador(equipeId: Id, jogadorId: Id): void {
    this.estado.garantirInscricoesAbertas();
    this.obterEquipe(equipeId).removerJogador(jogadorId);
  }

  // ---------- inscrições pelos espectadores (R17 a R21) ----------

  /**
   * R17: um time por conta, enviado de uma vez com o elenco completo.
   * O modo de inscrição (Strategy) decide se o time já entra aprovado ou fica pendente.
   */
  solicitarInscricao(responsavelId: Id, dados: DadosDaInscricao): Equipe {
    this.estado.garantirInscricoesAbertas();
    this.garantirQuePodeInscrever(responsavelId);
    const atual = this.equipeDoResponsavel(responsavelId);
    if (atual?.recusada) throw new RegraDeNegocioError('Sua inscrição foi recusada: corrija e reenvie o mesmo time');
    if (atual) throw new RegraDeNegocioError('Você já inscreveu um time neste campeonato');

    const estadoInicial = this._modoInscricao.estadoInicialParaEspectador();
    const equipe = Equipe.criar(dados.nome, { responsavelId, inscricao: estadoInicial });
    this.garantirQueCabe(equipe.nome);
    for (const j of this.montarElenco(dados.jogadores)) equipe.adicionarJogador(j, this.regulamento.props.maxJogadores);
    this._equipes.push(equipe);
    return equipe;
  }

  /** R20: inscrição recusada pode ser corrigida e reenviada. */
  reenviarInscricao(responsavelId: Id, dados: DadosDaInscricao): Equipe {
    this.estado.garantirInscricoesAbertas();
    this.garantirQuePodeInscrever(responsavelId);
    const equipe = this.equipeDoResponsavel(responsavelId);
    if (!equipe) throw new NaoEncontradoError('Você ainda não inscreveu um time neste campeonato');

    const destino = this._modoInscricao.estadoInicialParaEspectador();
    const nome = dados.nome?.trim();
    this.garantirQueCabe(nome, equipe);
    const elenco = this.montarElenco(dados.jogadores, equipe);
    const camisas = new Set(elenco.map((j) => j.numero));
    garantir(camisas.size === elenco.length, 'Há números de camisa repetidos no elenco');
    equipe.reenviar(destino, nome, elenco);
    return equipe;
  }

  /** R19: inscrições pendentes esperam um organizador. */
  aprovarInscricao(equipeId: Id): void {
    this.estado.garantirInscricoesAbertas();
    this.obterEquipe(equipeId).aprovar();
  }

  recusarInscricao(equipeId: Id, motivo: string): void {
    this.estado.garantirInscricoesAbertas();
    this.obterEquipe(equipeId).recusar(motivo);
  }

  private garantirQuePodeInscrever(usuarioId: Id): void {
    if (this.estaBanidoDeInscrever(usuarioId)) {
      throw new RegraDeNegocioError('Sua conta foi impedida pelos organizadores de inscrever times neste campeonato');
    }
    if (this.fazParteDaOrganizacao(usuarioId)) {
      throw new RegraDeNegocioError('Organizadores inscrevem times pela área de equipes');
    }
  }

  /** Nome único e limite de equipes; `ignorar` é a própria equipe num reenvio. */
  private garantirQueCabe(nome: string, ignorar?: Equipe): void {
    const outras = this._equipes.filter((e) => e !== ignorar);
    if (outras.some((e) => e.nome.toLowerCase() === nome?.toLowerCase())) {
      throw new RegraDeNegocioError(`Já existe uma equipe chamada ${nome} neste campeonato`);
    }
    if (!ignorar && outras.length >= MAXIMO_DE_EQUIPES) {
      throw new RegraDeNegocioError(`O campeonato aceita no máximo ${MAXIMO_DE_EQUIPES} equipes`);
    }
  }

  /** R2: o mesmo jogador (documento) não pode estar em duas equipes do campeonato. */
  private garantirDocumentoLivre(documento: string, ignorar?: Equipe): void {
    const outra = this._equipes.find((e) => e !== ignorar && e.possuiDocumento(documento));
    if (outra) throw new RegraDeNegocioError(`O documento ${documento} já está inscrito na equipe ${outra.nome}`);
  }

  /** Valida o elenco completo de uma inscrição de espectador (R1 e R2). */
  private montarElenco(dados: DadosDoJogador[], ignorar?: Equipe): Jogador[] {
    const { minJogadores, maxJogadores } = this.regulamento.props;
    const lista = dados ?? [];
    if (lista.length < minJogadores || lista.length > maxJogadores) {
      throw new RegraDeNegocioError(`O elenco precisa ter entre ${minJogadores} e ${maxJogadores} jogadores; foram enviados ${lista.length}`);
    }
    const jogadores = lista.map((d) => Jogador.criar(d));
    const docs = new Set<string>();
    for (const j of jogadores) {
      const doc = j.documento.toLowerCase();
      if (docs.has(doc)) throw new RegraDeNegocioError(`O documento ${j.documento} aparece duas vezes no elenco`);
      docs.add(doc);
      this.garantirDocumentoLivre(j.documento, ignorar);
    }
    return jogadores;
  }

  /** Fecha as inscrições e gera a primeira fase com todas as rodadas. */
  iniciar(): void {
    const proximo = this.estado.iniciar(); // lança erro se não estiver em inscrições
    const pendentes = this.inscricoesPendentes.length;
    if (pendentes) {
      throw new RegraDeNegocioError(`Há ${pendentes} inscrição(ões) pendente(s): aprove ou recuse antes de iniciar`);
    }
    const aprovadas = this.equipesAprovadas;
    garantir(aprovadas.length >= 2, 'São necessárias pelo menos 2 equipes para iniciar');
    const min = this.regulamento.props.minJogadores;
    for (const e of aprovadas) {
      if (e.jogadores.length < min) {
        throw new RegraDeNegocioError(`A equipe ${e.nome} tem ${e.jogadores.length} jogadores; o mínimo é ${min}`);
      }
    }
    const formato = this.formato;
    formato.validarInicio(aprovadas.length, this.regulamento.props);
    // times recusados saem de vez quando o campeonato começa
    for (const e of this._equipes.filter((x) => x.recusada)) this._equipes.splice(this._equipes.indexOf(e), 1);
    this._fases.push(formato.gerarFaseInicial(this.contextoDoFormato()));
    this.estado = proximo;
  }

  // ---------- organização (R22 a R24) ----------

  /** O e-mail precisa ser de uma conta existente: quem confere isso é o caso de uso. */
  convidarPorEmail(convidado: ContaConvidada, criadoPor: Id): ConvitePorEmail {
    if (this.fazParteDaOrganizacao(convidado.id)) throw new RegraDeNegocioError('Essa conta já faz parte da organização');
    const convite = ConviteFactory.porEmail(convidado.email, criadoPor);
    if (this._convites.some((c) => c.ativo && c instanceof ConvitePorEmail && c.ehPara(convite.email))) {
      throw new RegraDeNegocioError('Já existe um convite pendente para esse e-mail');
    }
    this._convites.push(convite);
    return convite;
  }

  gerarLinkDeConvite(criadoPor: Id): ConvitePorLink {
    const convite = ConviteFactory.porLink(criadoPor);
    this._convites.push(convite);
    return convite;
  }

  obterConvite(conviteId: Id): Convite {
    const c = this._convites.find((x) => x.id === conviteId);
    if (!c) throw new NaoEncontradoError('Convite não encontrado');
    return c;
  }

  conviteComToken(token: string): ConvitePorLink | undefined {
    return this._convites.find((c): c is ConvitePorLink => c instanceof ConvitePorLink && c.token === token);
  }

  revogarConvite(conviteId: Id): void {
    this.obterConvite(conviteId).revogar();
  }

  /** Quem aceita vira organizador convidado; um banimento anterior deixa de valer. */
  aceitarConvite(convite: Convite, conta: ContaConvidada): void {
    garantir(this._convites.includes(convite), 'Convite de outro campeonato');
    if (this.fazParteDaOrganizacao(conta.id)) throw new RegraDeNegocioError('Você já faz parte da organização deste campeonato');
    convite.aceitar(conta);
    this._organizadores.push(conta.id);
    this._banimentos = this._banimentos.filter((b) => b.usuarioId !== conta.id);
  }

  recusarConvite(conviteId: Id, conta: ContaConvidada): void {
    this.obterConvite(conviteId).recusar(conta);
  }

  /** R23: só o criador remove organizadores, e ninguém remove o criador. */
  removerOrganizador(usuarioId: Id): void {
    if (this.ehCriador(usuarioId)) throw new RegraDeNegocioError('O criador não pode ser removido da organização');
    const i = this._organizadores.indexOf(usuarioId);
    if (i < 0) throw new NaoEncontradoError('Essa conta não é organizadora deste campeonato');
    this._organizadores.splice(i, 1);
  }

  sairDaOrganizacao(usuarioId: Id): void {
    if (this.ehCriador(usuarioId)) throw new RegraDeNegocioError('O criador não pode sair do próprio campeonato');
    this.removerOrganizador(usuarioId);
  }

  /**
   * R21: banir impede a conta de inscrever times (e, no nível VISUALIZACAO, de ver o campeonato).
   * Um time pendente dessa conta é recusado na hora; um time já aprovado continua.
   */
  banir(usuarioId: Id, nivel: NivelBanimento, motivo: string, banidoPor: Id): void {
    if (this.fazParteDaOrganizacao(usuarioId)) throw new RegraDeNegocioError('Organizadores não podem ser banidos');
    const banimento = Banimento.aplicar({ usuarioId, nivel, motivo, banidoPor });
    this._banimentos = [...this._banimentos.filter((b) => b.usuarioId !== usuarioId), banimento];
    const pendente = this._equipes.find((e) => e.ehDe(usuarioId) && e.pendente);
    if (pendente) pendente.recusar(motivo?.trim() ? `Conta banida: ${motivo.trim()}` : 'Conta banida pelos organizadores');
  }

  desbanir(usuarioId: Id): void {
    if (!this.banimentoDe(usuarioId)) throw new NaoEncontradoError('Essa conta não está banida');
    this._banimentos = this._banimentos.filter((b) => b.usuarioId !== usuarioId);
  }

  // ---------- súmula ----------

  iniciarPartida(partidaId: Id): void {
    this.estado.garantirEmAndamento();
    this.obterPartida(partidaId).iniciar();
  }

  registrarEvento(partidaId: Id, dados: { tipo: TipoEvento; jogadorId: Id; minuto: number }): EventoPartida[] {
    this.estado.garantirEmAndamento();
    const partida = this.obterPartida(partidaId);
    const equipe = this.equipeDoJogador(dados.jogadorId);
    if (!equipe) throw new NaoEncontradoError('Jogador não encontrado neste campeonato');
    return partida.registrarEvento(dados.tipo, dados.jogadorId, equipe.id, dados.minuto, {
      jogadorSuspenso: this.estaSuspenso(dados.jogadorId, partidaId),
    });
  }

  removerEvento(partidaId: Id, eventoId: Id): void {
    this.estado.garantirEmAndamento();
    this.obterPartida(partidaId).removerEvento(eventoId);
  }

  finalizarPartida(partidaId: Id, penaltis?: Placar | null): void {
    this.estado.garantirEmAndamento();
    const partida = this.obterPartida(partidaId);
    partida.finalizar(penaltis);
    for (const o of this.observadores) o.aoFinalizarPartida(partida, this); // Observer
  }

  // ---------- usados pelos observadores ----------

  estaSuspenso(jogadorId: Id, partidaId: Id): boolean {
    return this._suspensoes.some((s) => s.jogadorId === jogadorId && s.valePara(partidaId));
  }

  /** Amarelos válidos para acúmulo: os de partidas em que o jogador não foi expulso. */
  amarelosAcumuladosDo(jogadorId: Id): number {
    return this.todasAsPartidas()
      .filter((p) => p.finalizada && !p.foiExpulso(jogadorId))
      .reduce((soma, p) => soma + p.amarelosDo(jogadorId), 0);
  }

  aplicarSuspensao(s: Suspensao): void {
    this._suspensoes.push(s);
  }

  adicionarFase(fase: Fase): void {
    this.estado.garantirEmAndamento();
    this._fases.push(fase);
  }

  encerrar(campeaoId: Id): void {
    this.estado = this.estado.encerrar();
    this._campeaoId = campeaoId;
  }

  contextoDoFormato(): ContextoFormato {
    return {
      equipes: this.equipesAprovadas.map((e) => ({ id: e.id, nome: e.nome })),
      classificacao: this.regulamento.criarClassificacao(),
      regulamento: this.regulamento.props,
    };
  }

  // ---------- persistência ----------

  /** Chamado pelo repositório depois de gravar: a próxima gravação precisa partir desta versão. */
  registrarGravacao(): void {
    this._versao++;
  }

  // ---------- consultas ----------

  /** Tabela de cada grupo das fases de pontos (pontos corridos ou grupos). */
  tabelas(): { faseId: Id; fase: string; grupo: string; linhas: LinhaTabela[] }[] {
    const classificacao = this.regulamento.criarClassificacao();
    return this._fases
      .filter((f) => !f.eliminatoria)
      .flatMap((f) =>
        f.grupos.map((g) => ({
          faseId: f.id,
          fase: f.nome,
          grupo: g.nome,
          linhas: classificacao.calcular(
            this._equipes.filter((e) => g.equipeIds.includes(e.id)),
            f.partidasDoGrupo(g.nome),
          ),
        })),
      );
  }

  artilharia(): LinhaArtilharia[] {
    const gols = new Map<Id, number>();
    for (const p of this.todasAsPartidas()) {
      for (const e of p.eventos) if (e.tipo === 'GOL') gols.set(e.jogadorId, (gols.get(e.jogadorId) ?? 0) + 1);
    }
    const linhas: LinhaArtilharia[] = [];
    for (const [jogadorId, total] of gols) {
      const equipe = this.equipeDoJogador(jogadorId);
      const jogador = equipe?.buscarJogador(jogadorId);
      if (!equipe || !jogador) continue;
      linhas.push({ jogadorId, nome: jogador.nome, equipeId: equipe.id, equipe: equipe.nome, gols: total });
    }
    return linhas.sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  snapshot(): CampeonatoSnapshot {
    return {
      id: this.id,
      nome: this.nome,
      descricao: this.descricao,
      modalidade: this.modalidade,
      criadorId: this.criadorId,
      organizadores: [...this._organizadores],
      status: this.status,
      visibilidade: this._visibilidade.tipo,
      modoInscricao: this._modoInscricao.tipo,
      chaveAcesso: this._chaveDeAcesso.valor,
      regulamento: this.regulamento.snapshot(),
      equipes: this._equipes.map((e) => e.snapshot()),
      fases: this._fases.map((f) => f.snapshot()),
      suspensoes: this._suspensoes.map((s) => s.snapshot()),
      convites: this._convites.map((c) => c.snapshot()),
      banimentos: this._banimentos.map((b) => b.snapshot()),
      campeaoId: this._campeaoId,
      criadoEm: this.criadoEm.toISOString(),
      versao: this._versao,
    };
  }
}
