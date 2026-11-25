import { DynamicModule, Inject, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Provider } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { Autenticar, RegistrarUsuario } from './application/casos-de-uso/auth';
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
} from './application/casos-de-uso/campeonatos';
import { AlterarConfiguracao, AlterarRegulamento, ExcluirCampeonato, RegenerarChaveDeAcesso } from './application/casos-de-uso/configuracao';
import {
  AprovarInscricao,
  BanirConta,
  DesbanirConta,
  ReenviarInscricao,
  RecusarInscricao,
  SolicitarInscricao,
} from './application/casos-de-uso/inscricoes';
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
} from './application/casos-de-uso/organizacao';
import { GERADOR_DE_HASH, GERADOR_DE_TOKEN, GeradorDeHash } from './application/portas/portas';
import { CAMPEONATO_REPOSITORY, CampeonatoRepository, USUARIO_REPOSITORY, UsuarioRepository } from './domain';
import { CampeonatoApresentador } from './infra/http/apresentador';
import { AutenticacaoGuard, AutenticacaoOpcionalGuard, LeitorDeSessao } from './infra/http/autenticacao';
import {
  AuthController,
  CampeonatosController,
  ConvitesController,
  EquipesController,
  InscricaoController,
  OrganizacaoController,
  PartidasController,
} from './infra/http/controllers';
import { CampeonatoRepositoryEmMemoria, UsuarioRepositoryEmMemoria } from './infra/persistence/memoria/repositorios-memoria';
import { criarPool, migrar } from './infra/persistence/postgres/conexao';
import { CampeonatoRepositoryPostgres, UsuarioRepositoryPostgres } from './infra/persistence/postgres/repositorios-postgres';
import { semearDemo } from './infra/seed/seed-demo';
import { HashBcrypt, TokenJwt } from './infra/seguranca/seguranca';

export interface OpcoesApp {
  persistencia: 'memoria' | 'postgres';
  databaseUrl?: string;
  jwtSecret: string;
  semearDemo: boolean;
}

export const OPCOES = Symbol('OpcoesApp');
const POOL = Symbol('Pool');

/** Registra um caso de uso cujo construtor recebe as dependências listadas. */
function casoDeUso<T>(classe: new (...args: never[]) => T, ...deps: (symbol | Function)[]): Provider {
  return { provide: classe, useFactory: (...args: never[]) => new classe(...args), inject: deps };
}

const R = CAMPEONATO_REPOSITORY;
const U = USUARIO_REPOSITORY;

/** Casos de uso que só dependem do repositório de campeonatos. */
const SO_CAMPEONATOS = [
  ListarCampeonatos,
  ObterCampeonato,
  CriarCampeonato,
  InscreverEquipe,
  RemoverEquipe,
  AdicionarJogador,
  RemoverJogador,
  IniciarCampeonato,
  IniciarPartida,
  RegistrarEvento,
  RemoverEvento,
  FinalizarPartida,
  AlterarConfiguracao,
  AlterarRegulamento,
  RegenerarChaveDeAcesso,
  ExcluirCampeonato,
  SolicitarInscricao,
  ReenviarInscricao,
  AprovarInscricao,
  RecusarInscricao,
  BanirConta,
  DesbanirConta,
  GerarLinkDeConvite,
  RevogarConvite,
  RemoverOrganizador,
  SairDaOrganizacao,
  AceitarConvitePorEmail,
  RecusarConvitePorEmail,
  AceitarConvitePorLink,
  VerConvitePorLink,
  ListarMeusConvites,
];

/**
 * Composição da aplicação (injeção de dependência).
 * É o ÚNICO lugar que sabe qual implementação concreta cada interface usa.
 */
@Module({})
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('App');

  constructor(
    @Inject(OPCOES) private readonly opcoes: OpcoesApp,
    @Inject(POOL) private readonly pool: Pool | null,
    @Inject(CAMPEONATO_REPOSITORY) private readonly campeonatos: CampeonatoRepository,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(GERADOR_DE_HASH) private readonly hash: GeradorDeHash,
  ) {}

  static configurar(opcoes: OpcoesApp): DynamicModule {
    const postgres = opcoes.persistencia === 'postgres';
    return {
      module: AppModule,
      imports: [JwtModule.register({ secret: opcoes.jwtSecret, signOptions: { expiresIn: '7d' } })],
      controllers: [
        AuthController,
        CampeonatosController,
        EquipesController,
        InscricaoController,
        OrganizacaoController,
        ConvitesController,
        PartidasController,
      ],
      providers: [
        { provide: OPCOES, useValue: opcoes },
        { provide: POOL, useFactory: () => (postgres ? criarPool(opcoes.databaseUrl) : null) },
        {
          provide: CAMPEONATO_REPOSITORY,
          useFactory: (pool: Pool | null) => (pool ? new CampeonatoRepositoryPostgres(pool) : new CampeonatoRepositoryEmMemoria()),
          inject: [POOL],
        },
        {
          provide: USUARIO_REPOSITORY,
          useFactory: (pool: Pool | null) => (pool ? new UsuarioRepositoryPostgres(pool) : new UsuarioRepositoryEmMemoria()),
          inject: [POOL],
        },
        { provide: GERADOR_DE_HASH, useValue: new HashBcrypt() },
        { provide: TokenJwt, useFactory: (jwt: JwtService) => new TokenJwt(jwt), inject: [JwtService] },
        { provide: GERADOR_DE_TOKEN, useExisting: TokenJwt },
        LeitorDeSessao,
        AutenticacaoGuard,
        AutenticacaoOpcionalGuard,
        CampeonatoApresentador,

        casoDeUso(RegistrarUsuario, U, GERADOR_DE_HASH, GERADOR_DE_TOKEN),
        casoDeUso(Autenticar, U, GERADOR_DE_HASH, GERADOR_DE_TOKEN),
        casoDeUso(ConvidarPorEmail, R, U),
        ...SO_CAMPEONATOS.map((classe) => casoDeUso(classe as new (...args: never[]) => unknown, R)),
      ],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.pool) {
      const aplicadas = await migrar(this.pool);
      if (aplicadas.length) this.logger.log(`Migrações aplicadas: ${aplicadas.join(', ')}`);
    }
    if (this.opcoes.semearDemo && (await semearDemo(this.campeonatos, this.usuarios, this.hash))) {
      this.logger.log('Dados de demonstração criados (veja as contas demo no README)');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
