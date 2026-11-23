import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Autenticar, RegistrarUsuario } from '../../application/casos-de-uso/auth';
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
import { UsuarioDoToken } from '../seguranca/seguranca';
import { CampeonatoApresentador as A } from './apresentador';
import { AutenticacaoGuard, UsuarioAtual } from './autenticacao';
import {
  AdicionarJogadorDto,
  CriarCampeonatoDto,
  FinalizarPartidaDto,
  InscreverEquipeDto,
  LoginDto,
  RegistrarDto,
  RegistrarEventoDto,
} from './dto';

const Uuid = new ParseUUIDPipe({ version: '4' });

/** Controllers só traduzem HTTP ⇄ casos de uso. Nenhuma regra de negócio mora aqui. */
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
  eu(@UsuarioAtual() u: UsuarioDoToken) {
    return u;
  }
}

@Controller('campeonatos')
export class CampeonatosController {
  constructor(
    private readonly listar: ListarCampeonatos,
    private readonly obter: ObterCampeonato,
    private readonly criar: CriarCampeonato,
    private readonly inscrever: InscreverEquipe,
    private readonly removerEquipe: RemoverEquipe,
    private readonly adicionarJogador: AdicionarJogador,
    private readonly removerJogador: RemoverJogador,
    private readonly iniciar: IniciarCampeonato,
  ) {}

  // ---------- leitura (pública) ----------

  @Get()
  async todos() {
    return (await this.listar.executar()).map(A.resumo);
  }

  @Get(':id')
  async detalhe(@Param('id', Uuid) id: string) {
    return A.detalhe(await this.obter.executar(id));
  }

  @Get(':id/classificacao')
  async classificacao(@Param('id', Uuid) id: string) {
    return A.tabelas(await this.obter.executar(id));
  }

  @Get(':id/artilharia')
  async artilharia(@Param('id', Uuid) id: string) {
    return (await this.obter.executar(id)).artilharia();
  }

  @Get(':id/suspensoes')
  async suspensoes(@Param('id', Uuid) id: string) {
    return A.suspensoes(await this.obter.executar(id));
  }

  // ---------- escrita (organizador) ----------

  @Post()
  @UseGuards(AutenticacaoGuard)
  async novo(@Body() dto: CriarCampeonatoDto, @UsuarioAtual() u: UsuarioDoToken) {
    return A.detalhe(await this.criar.executar({ ...dto, organizadorId: u.id }));
  }

  @Post(':id/equipes')
  @UseGuards(AutenticacaoGuard)
  async novaEquipe(@Param('id', Uuid) id: string, @Body() dto: InscreverEquipeDto, @UsuarioAtual() u: UsuarioDoToken) {
    return A.detalhe(await this.inscrever.executar(id, u.id, dto));
  }

  @Delete(':id/equipes/:equipeId')
  @UseGuards(AutenticacaoGuard)
  async excluirEquipe(@Param('id', Uuid) id: string, @Param('equipeId', Uuid) equipeId: string, @UsuarioAtual() u: UsuarioDoToken) {
    return A.detalhe(await this.removerEquipe.executar(id, u.id, { equipeId }));
  }

  @Post(':id/equipes/:equipeId/jogadores')
  @UseGuards(AutenticacaoGuard)
  async novoJogador(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @Body() dto: AdicionarJogadorDto,
    @UsuarioAtual() u: UsuarioDoToken,
  ) {
    return A.detalhe(await this.adicionarJogador.executar(id, u.id, { equipeId, ...dto }));
  }

  @Delete(':id/equipes/:equipeId/jogadores/:jogadorId')
  @UseGuards(AutenticacaoGuard)
  async excluirJogador(
    @Param('id', Uuid) id: string,
    @Param('equipeId', Uuid) equipeId: string,
    @Param('jogadorId', Uuid) jogadorId: string,
    @UsuarioAtual() u: UsuarioDoToken,
  ) {
    return A.detalhe(await this.removerJogador.executar(id, u.id, { equipeId, jogadorId }));
  }

  @Post(':id/iniciar')
  @HttpCode(200)
  @UseGuards(AutenticacaoGuard)
  async comecar(@Param('id', Uuid) id: string, @UsuarioAtual() u: UsuarioDoToken) {
    return A.detalhe(await this.iniciar.executar(id, u.id));
  }
}

@Controller('campeonatos/:id/partidas/:partidaId')
@UseGuards(AutenticacaoGuard)
export class PartidasController {
  constructor(
    private readonly iniciar: IniciarPartida,
    private readonly registrar: RegistrarEvento,
    private readonly remover: RemoverEvento,
    private readonly finalizar: FinalizarPartida,
  ) {}

  @Post('iniciar')
  @HttpCode(200)
  async comecar(@Param('id', Uuid) id: string, @Param('partidaId', Uuid) partidaId: string, @UsuarioAtual() u: UsuarioDoToken) {
    return A.detalhe(await this.iniciar.executar(id, u.id, { partidaId }));
  }

  @Post('eventos')
  async evento(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Body() dto: RegistrarEventoDto,
    @UsuarioAtual() u: UsuarioDoToken,
  ) {
    return A.detalhe(await this.registrar.executar(id, u.id, { partidaId, ...dto }));
  }

  @Delete('eventos/:eventoId')
  async desfazer(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Param('eventoId', Uuid) eventoId: string,
    @UsuarioAtual() u: UsuarioDoToken,
  ) {
    return A.detalhe(await this.remover.executar(id, u.id, { partidaId, eventoId }));
  }

  @Post('finalizar')
  @HttpCode(200)
  async encerrar(
    @Param('id', Uuid) id: string,
    @Param('partidaId', Uuid) partidaId: string,
    @Body() dto: FinalizarPartidaDto,
    @UsuarioAtual() u: UsuarioDoToken,
  ) {
    const penaltis =
      dto.penaltisMandante !== undefined && dto.penaltisVisitante !== undefined
        ? { mandante: dto.penaltisMandante, visitante: dto.penaltisVisitante }
        : null;
    return A.detalhe(await this.finalizar.executar(id, u.id, { partidaId, penaltis }));
  }
}
