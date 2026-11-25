import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Autenticar, RegistrarUsuario } from '../../application/casos-de-uso/auth';
import { CampeonatoVisto, Contexto } from '../../application/casos-de-uso/base';
import {
  AdicionarJogador,
  CriarCampeonato,
  FinalizarPartida,
  IniciarCampeonato,
  IniciarPartida,
  InscreverEquipe,
  ListarCampeonatos,
  ObterCampeonato,
  RegistrarEvento,
  RemoverEquipe,
  RemoverEvento,
  RemoverJogador,
} from '../../application/casos-de-uso/campeonatos';
import { AlterarConfiguracao, AlterarRegulamento, ExcluirCampeonato, RegenerarChaveDeAcesso } from '../../application/casos-de-uso/configuracao';
import {
  AprovarInscricao,
  BanirConta,
  DesbanirConta,
  ReenviarInscricao,
  RecusarInscricao,
  SolicitarInscricao,
} from '../../application/casos-de-uso/inscricoes';
import {
  AceitarConvitePorEmail,
  AceitarConvitePorLink,
  ConvidarPorEmail,
  GerarLinkDeConvite,
  ListarMeusConvites,
  RecusarConvitePorEmail,
  RemoverOrganizador,
  RevogarConvite,
  SairDaOrganizacao,
  VerConvitePorLink,
} from '../../application/casos-de-uso/organizacao';
import { Ator } from '../../domain';
import { CampeonatoApresentador } from './apresentador';
import { AtorAtual, AutenticacaoGuard, AutenticacaoOpcionalGuard, ChaveInformada } from './autenticacao';
import {
  AdicionarJogadorDto,
  AlterarConfiguracaoDto,
  BanirDto,
  ConvidarPorEmailDto,
  CriarCampeonatoDto,
  FinalizarPartidaDto,
  InscreverEquipeDto,
  LoginDto,
  RecusarInscricaoDto,
  RegistrarDto,
  RegistrarEventoDto,
  RegulamentoDto,
  SolicitarInscricaoDto,
} from './dto';

const Uuid = new ParseUUIDPipe({ version: '4' });
const ctx = (ator: Ator, chave: string | null): Contexto => ({ ator, chave });

/** Controllers só traduzem HTTP ⇄ casos de uso. Nenhuma regra de negócio nem de permissão mora aqui. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrar: RegistrarUsuario,
    private readonly autenticar: Autenticar,
  ) {}

  @Post('registrar')
  criarConta(@Body() dto: RegistrarDto) {
    return this.registrar.executar(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.autenticar.executar(dto);
  }

  @Get('eu')
  @UseGuards(AutenticacaoGuard)
  eu(@AtorAtual() a: Ator) {
    return { ...a.conta, papel: a.papelNoSite!.tipo };
  }
}

@Controller('campeonatos')
export class CampeonatosController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly listar: ListarCampeonatos,
    private readonly obter: ObterCampeonato,
    private readonly criar: CriarCampeonato,
    private readonly configurar: AlterarConfiguracao,
    private readonly alterarRegulamento: AlterarRegulamento,
    private readonly regenerarChave: RegenerarChaveDeAcesso,
    private readonly excluir: ExcluirCampeonato,
    private readonly iniciar: IniciarCampeonato,
  ) {}

  // ---------- leitura (login opcional) ----------

  @Get()
  @UseGuards(AutenticacaoOpcionalGuard)
  async todos(@AtorAtual() a: Ator) {
    return (await this.listar.executar(ctx(a, null))).map((v) => this.ap.resumo(v));
  }

  @Get(':id')
  @UseGuards(AutenticacaoOpcionalGuard)
  async detalhe(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.obter.executar(id, ctx(a, chave)), a);
  }

  @Get(':id/classificacao')
  @UseGuards(AutenticacaoOpcionalGuard)
  async classificacao(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return CampeonatoApresentador.tabelas((await this.obter.executar(id, ctx(a, chave))).campeonato);
  }

  @Get(':id/artilharia')
  @UseGuards(AutenticacaoOpcionalGuard)
  async artilharia(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return (await this.obter.executar(id, ctx(a, chave))).campeonato.artilharia();
  }

  @Get(':id/suspensoes')
  @UseGuards(AutenticacaoOpcionalGuard)
  async suspensoes(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return CampeonatoApresentador.suspensoes((await this.obter.executar(id, ctx(a, chave))).campeonato);
  }

  // ---------- escrita ----------

  @Post()
  @UseGuards(AutenticacaoGuard)
  async novo(@Body() dto: CriarCampeonatoDto, @AtorAtual() a: Ator) {
    return this.ap.detalhe(await this.criar.executar(ctx(a, null), dto), a);
  }

  @Patch(':id')
  @UseGuards(AutenticacaoGuard)
  async alterar(@Param('id', Uuid) id: string, @Body() dto: AlterarConfiguracaoDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.configurar.executar(id, ctx(a, chave), dto), a);
  }

  @Patch(':id/regulamento')
  @UseGuards(AutenticacaoGuard)
  async regulamento(@Param('id', Uuid) id: string, @Body() dto: RegulamentoDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.alterarRegulamento.executar(id, ctx(a, chave), dto), a);
  }

  @Post(':id/chave-de-acesso')
  @HttpCode(200)
  @UseGuards(AutenticacaoGuard)
  async novaChave(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.regenerarChave.executar(id, ctx(a, chave)), a);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AutenticacaoGuard)
  async apagar(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    await this.excluir.executar(id, ctx(a, chave));
  }

  @Post(':id/iniciar')
  @HttpCode(200)
  @UseGuards(AutenticacaoGuard)
  async comecar(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.iniciar.executar(id, ctx(a, chave)), a);
  }
}

@Controller('campeonatos/:id/equipes')
@UseGuards(AutenticacaoGuard)
export class EquipesController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly inscrever: InscreverEquipe,
    private readonly removerEquipe: RemoverEquipe,
    private readonly adicionarJogador: AdicionarJogador,
    private readonly removerJogador: RemoverJogador,
    private readonly aprovar: AprovarInscricao,
    private readonly recusar: RecusarInscricao,
  ) {}

  @Post()
  async novaEquipe(@Param('id', Uuid) id: string, @Body() dto: InscreverEquipeDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.inscrever.executar(id, ctx(a, chave), dto), a);
  }

  @Delete(':equipeId')
  async excluirEquipe(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.removerEquipe.executar(id, ctx(a, chave), { equipeId }), a);
  }

  @Post(':equipeId/jogadores')
  async novoJogador(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @Body() dto: AdicionarJogadorDto,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.adicionarJogador.executar(id, ctx(a, chave), { equipeId, ...dto }), a);
  }

  @Delete(':equipeId/jogadores/:jogadorId')
  async excluirJogador(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @Param('jogadorId', Uuid) jogadorId: string,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.removerJogador.executar(id, ctx(a, chave), { equipeId, jogadorId }), a);
  }

  @Post(':equipeId/aprovar')
  @HttpCode(200)
  async aprovarEquipe(@Param('id', Uuid) id: string, @Param('equipeId', Uuid) equipeId: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.aprovar.executar(id, ctx(a, chave), { equipeId }), a);
  }

  @Post(':equipeId/recusar')
  @HttpCode(200)
  async recusarEquipe(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @Body() dto: RecusarInscricaoDto,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.recusar.executar(id, ctx(a, chave), { equipeId, motivo: dto.motivo }), a);
  }
}

/** Inscrição do próprio time por um espectador logado. */
@Controller('campeonatos/:id/inscricao')
@UseGuards(AutenticacaoGuard)
export class InscricaoController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly solicitar: SolicitarInscricao,
    private readonly reenviar: ReenviarInscricao,
  ) {}

  @Post()
  async enviar(@Param('id', Uuid) id: string, @Body() dto: SolicitarInscricaoDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.solicitar.executar(id, ctx(a, chave), dto), a);
  }

  @Post('reenviar')
  @HttpCode(200)
  async reenviarInscricao(@Param('id', Uuid) id: string, @Body() dto: SolicitarInscricaoDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.reenviar.executar(id, ctx(a, chave), dto), a);
  }
}

@Controller('campeonatos/:id')
@UseGuards(AutenticacaoGuard)
export class OrganizacaoController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly convidar: ConvidarPorEmail,
    private readonly gerarLink: GerarLinkDeConvite,
    private readonly revogar: RevogarConvite,
    private readonly aceitar: AceitarConvitePorEmail,
    private readonly recusar: RecusarConvitePorEmail,
    private readonly remover: RemoverOrganizador,
    private readonly sair: SairDaOrganizacao,
    private readonly banir: BanirConta,
    private readonly desbanir: DesbanirConta,
  ) {}

  @Post('convites')
  async conviteEmail(@Param('id', Uuid) id: string, @Body() dto: ConvidarPorEmailDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.convidar.executar(id, ctx(a, chave), dto), a);
  }

  @Post('convites/link')
  async conviteLink(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.gerarLink.executar(id, ctx(a, chave)), a);
  }

  @Delete('convites/:conviteId')
  async revogarConvite(@Param('id', Uuid) id: string, @Param('conviteId', Uuid) conviteId: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.revogar.executar(id, ctx(a, chave), { conviteId }), a);
  }

  @Post('convites/:conviteId/aceitar')
  @HttpCode(200)
  async aceitarConvite(@Param('id', Uuid) id: string, @Param('conviteId', Uuid) conviteId: string, @AtorAtual() a: Ator) {
    return this.ap.detalhe(await this.aceitar.executar(id, conviteId, ctx(a, null)), a);
  }

  @Post('convites/:conviteId/recusar')
  @HttpCode(204)
  async recusarConvite(@Param('id', Uuid) id: string, @Param('conviteId', Uuid) conviteId: string, @AtorAtual() a: Ator) {
    await this.recusar.executar(id, conviteId, ctx(a, null));
  }

  @Delete('organizadores/:usuarioId')
  async removerOrganizador(@Param('id', Uuid) id: string, @Param('usuarioId', Uuid) usuarioId: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.remover.executar(id, ctx(a, chave), { usuarioId }), a);
  }

  @Post('organizadores/sair')
  @HttpCode(200)
  async sairDaOrganizacao(@Param('id', Uuid) id: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.sair.executar(id, ctx(a, chave)), a);
  }

  @Post('banimentos')
  async banirConta(@Param('id', Uuid) id: string, @Body() dto: BanirDto, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.banir.executar(id, ctx(a, chave), dto), a);
  }

  @Delete('banimentos/:usuarioId')
  async desbanirConta(@Param('id', Uuid) id: string, @Param('usuarioId', Uuid) usuarioId: string, @AtorAtual() a: Ator, @ChaveInformada() chave: string | null) {
    return this.ap.detalhe(await this.desbanir.executar(id, ctx(a, chave), { usuarioId }), a);
  }
}

/** Convites vistos pelo lado de quem foi convidado. */
@Controller('convites')
@UseGuards(AutenticacaoGuard)
export class ConvitesController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly meus: ListarMeusConvites,
    private readonly ver: VerConvitePorLink,
    private readonly aceitar: AceitarConvitePorLink,
  ) {}

  @Get()
  meusConvites(@AtorAtual() a: Ator) {
    return this.meus.executar(ctx(a, null));
  }

  @Get('link/:token')
  verLink(@Param('token') token: string, @AtorAtual() a: Ator) {
    return this.ver.executar(token, ctx(a, null));
  }

  @Post('link/:token/aceitar')
  @HttpCode(200)
  async aceitarLink(@Param('token') token: string, @AtorAtual() a: Ator) {
    const visto: CampeonatoVisto = await this.aceitar.executar(token, ctx(a, null));
    return this.ap.detalhe(visto, a);
  }
}

@Controller('campeonatos/:id/partidas/:partidaId')
@UseGuards(AutenticacaoGuard)
export class PartidasController {
  constructor(
    private readonly ap: CampeonatoApresentador,
    private readonly iniciar: IniciarPartida,
    private readonly registrar: RegistrarEvento,
    private readonly remover: RemoverEvento,
    private readonly finalizar: FinalizarPartida,
  ) {}

  @Post('iniciar')
  @HttpCode(200)
  async comecar(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.iniciar.executar(id, ctx(a, chave), { partidaId }), a);
  }

  @Post('eventos')
  async evento(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Body() dto: RegistrarEventoDto,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.registrar.executar(id, ctx(a, chave), { partidaId, ...dto }), a);
  }

  @Delete('eventos/:eventoId')
  async desfazer(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Param('eventoId', Uuid) eventoId: string,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    return this.ap.detalhe(await this.remover.executar(id, ctx(a, chave), { partidaId, eventoId }), a);
  }

  @Post('finalizar')
  @HttpCode(200)
  async encerrar(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Body() dto: FinalizarPartidaDto,
    @AtorAtual() a: Ator,
    @ChaveInformada() chave: string | null,
  ) {
    const penaltis =
      dto.penaltisMandante !== undefined && dto.penaltisVisitante !== undefined
        ? { mandante: dto.penaltisMandante, visitante: dto.penaltisVisitante }
        : null;
    return this.ap.detalhe(await this.finalizar.executar(id, ctx(a, chave), { partidaId, penaltis }), a);
  }
}
