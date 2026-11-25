import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, OpcoesApp } from './app.module';
import { FiltroDeErros } from './infra/http/filtro-erros';

export function lerOpcoes(env = process.env): OpcoesApp {
  const persistencia = env.PERSISTENCIA === 'postgres' ? 'postgres' : 'memoria';
  // com banco de verdade, um segredo padrão deixaria qualquer um forjar tokens (inclusive de ADM)
  if (persistencia === 'postgres' && !env.JWT_SECRET) {
    throw new Error('Defina JWT_SECRET para usar PERSISTENCIA=postgres');
  }
  return {
    persistencia,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET || 'segredo-de-desenvolvimento',
    semearDemo: (env.SEED_DEMO ?? 'true') === 'true',
  };
}

/** Configuração compartilhada entre o servidor real e os testes e2e. */
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroDeErros());
  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  const opcoes = lerOpcoes();
  const app = configurarApp(await NestFactory.create(AppModule.configurar(opcoes)));
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API rodando em http://localhost:${porta}/api (persistência: ${opcoes.persistencia})`);
}

if (require.main === module) void bootstrap();
