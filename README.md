# Gestor de Campeonatos

Sistema web para organizar campeonatos esportivos. O organizador cria o campeonato, inscreve equipes e jogadores e preenche a súmula de cada partida. A **classificação, o chaveamento, a artilharia e as suspensões são calculados automaticamente pelo backend**.

Projeto da disciplina de Programação Orientada a Objetos: backend em TypeScript projetado com POO, frontend React que conversa com a API e testes automatizados para todas as regras de negócio.

| | |
|---|---|
| **Backend** | Node.js 22 · NestJS 11 · TypeScript |
| **Banco** | PostgreSQL 16 (SQL puro com `pg`) ou repositório em memória |
| **Frontend** | React 18 · Vite · TanStack Query · Tailwind CSS |
| **Testes** | Jest · Supertest (74 testes, ~96% de cobertura de linhas no domínio e na aplicação) |
| **CI** | GitHub Actions (testes com Postgres real + build do front) |

---

## Como rodar

Pré-requisito: **Node.js 22+**. O Docker só é necessário para usar o PostgreSQL.

### Modo rápido (sem banco, ideal para desenvolver e para a demo)

```bash
npm run instalar          # instala backend e frontend
npm run dev:backend       # API em http://localhost:3000/api
npm run dev:frontend      # em outro terminal: app em http://localhost:5173
```

A API sobe com **dados de demonstração**: três campeonatos (um em andamento, um com inscrições abertas e um encerrado) e o login `demo@campeonatos.dev` / `demo123`. No modo memória, os dados somem quando a API reinicia.

### Com PostgreSQL

```bash
docker compose up -d                  # sobe o Postgres
cd backend
cp .env.example .env                  # e troque PERSISTENCIA=memoria por PERSISTENCIA=postgres
npm run dev                           # aplica as migrações sozinho e cria os dados de demo
```

### Testes

```bash
cd backend
npm test                  # unitários + e2e (não precisam de banco)
npm run test:cov          # com relatório de cobertura (coverage/lcov-report/index.html)

# testes de integração com o Postgres do docker-compose:
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/campeonatos_test npm run test:integracao
```

---

## Arquitetura

O backend é organizado em camadas, e **as dependências sempre apontam para o domínio**: o domínio não importa nada de NestJS, HTTP ou banco. Por isso as regras rodam e são testadas em milissegundos, sem subir servidor nenhum.

```
frontend (React)  ──HTTP/JSON + JWT──▶  infra/http (controllers, DTOs, guard)
                                              │
                                              ▼
                                        application (casos de uso)
                                              │
                                              ▼
                                        domain (entidades e regras)  ◀── infra/persistence
                                                                          (memória ou PostgreSQL
                                                                           implementam as interfaces
                                                                           de repositório do domínio)
```

```
gestor-campeonatos/
├── backend/
│   ├── src/
│   │   ├── domain/                    ← o coração do projeto (POO pura)
│   │   │   ├── entidades/             Campeonato, Equipe, Jogador, Partida, Fase, Regulamento, Usuario + States
│   │   │   ├── eventos/               EventoPartida (abstrata) → Gol, CartaoAmarelo, CartaoVermelho
│   │   │   ├── formatos/              FormatoTorneio (interface) → PontosCorridos, MataMata, FaseDeGrupos
│   │   │   ├── desempate/             CriterioDesempate (Chain of Responsibility), Classificacao
│   │   │   ├── pontuacao/             RegraPontuacao (Strategy)
│   │   │   ├── disciplina/            Suspensao, ObservadorDePartida (Observer)
│   │   │   ├── repositorios/          interfaces CampeonatoRepository, UsuarioRepository
│   │   │   └── compartilhado/         hierarquia de erros, ids
│   │   ├── application/               casos de uso (Template Method) e portas (hash, token)
│   │   ├── infra/
│   │   │   ├── http/                  controllers, DTOs, guard JWT, filtro de erros, apresentador
│   │   │   ├── persistence/           memoria/ e postgres/ (SQL, migrações, repositórios)
│   │   │   ├── seguranca/             bcrypt e JWT
│   │   │   └── seed/                  dados de demonstração
│   │   ├── app.module.ts              composição: liga cada interface à sua implementação
│   │   └── main.ts
│   └── test/
│       ├── unit/domain/               regras de negócio (sem banco, sem HTTP)
│       ├── e2e/                       API inteira via HTTP
│       ├── integracao/                repositório contra PostgreSQL real
│       └── builders/                  CampeonatoBuilder e helpers de teste
├── frontend/src/
│   ├── pages/                         Campeonatos, Entrar, NovoCampeonato, PainelCampeonato, Sumula
│   ├── components/                    tabela, chaveamento, rodadas, artilharia, equipes, UI
│   ├── api/                           cliente axios, hooks do TanStack Query, tipos
│   └── auth/                          contexto de login
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Onde está cada conceito de POO (roteiro para o tour do código)

| Conceito | Onde ver | O que mostrar |
|---|---|---|
| **Encapsulamento** | `domain/entidades/campeonato.ts` | Listas privadas (`_equipes`, `_fases`) expostas como `readonly`; toda mudança passa por métodos que validam as regras. |
| **Herança + classe abstrata** | `domain/eventos/evento-partida.ts` | `EventoPartida` abstrata → `Gol`, `Cartao` (abstrata) → `CartaoAmarelo`, `CartaoVermelho`. |
| **Polimorfismo** | `Partida.estatisticas()` | `evento.aplicarEm(estatisticas)` sem nenhum `if` por tipo; cada evento sabe seu efeito e seus pontos de fair play. |
| **Interfaces** | `domain/formatos/formato-torneio.ts`, `domain/repositorios/repositorios.ts` | O Campeonato só conhece a interface `FormatoTorneio`; os casos de uso só conhecem `CampeonatoRepository`. |
| **Strategy** | `formatos/` e `pontuacao/` | `PontosCorridos`, `MataMata` e `FaseDeGrupos` trocáveis; `RegraPontuacao` configurável. |
| **Chain of Responsibility** | `desempate/criterios.ts` | Cada `CriterioDesempate` tenta separar duas equipes e, se empatar, passa para o próximo elo. A ordem vem do regulamento. |
| **State** | `entidades/estado-partida.ts`, `entidades/estado-campeonato.ts` | `Agendada → EmAndamento → Finalizada` e `InscricoesAbertas → EmAndamento → Encerrado`; cada estado libera só as ações válidas. |
| **Observer** | `disciplina/observadores.ts` | Ao finalizar uma partida, `ControleDisciplinar` gera e cumpre suspensões e `AvancoDeFase` cria a próxima fase ou define o campeão. |
| **Template Method** | `application/casos-de-uso/campeonatos.ts` | `CasoDeUsoDoOrganizador` fixa "carregar → conferir dono → aplicar → salvar"; cada caso de uso só implementa `aplicar`. Também em `CriterioDesempate.comparar`. |
| **Factory** | `FormatoFactory`, `EventoFactory`, `CadeiaDeDesempateFactory` | Criam a subclasse certa a partir de um tipo vindo da API ou do banco. |
| **Composição** | `formatos/fase-de-grupos.ts` | `FaseDeGrupos` *tem um* `MataMata` e reaproveita o chaveamento sem herdar dele. |
| **Value Object** | `entidades/regulamento.ts` | `Regulamento` imutável e validado na criação. |
| **Inversão de dependência** | `app.module.ts` | Troca memória ↔ PostgreSQL com uma variável de ambiente, sem mudar uma linha do domínio. Os testes usam o repositório em memória. |
| **Repository** | `infra/persistence/` | Duas implementações da mesma interface. |

### Diagrama de classes (domínio)

```mermaid
classDiagram
  direction LR
  class Campeonato {
    -estado: EstadoCampeonato
    -equipes: Equipe[]
    -fases: Fase[]
    -suspensoes: Suspensao[]
    +inscreverEquipe(nome)
    +adicionarJogador(equipeId, dados)
    +iniciar()
    +registrarEvento(partidaId, evento)
    +finalizarPartida(partidaId, penaltis)
    +tabelas()
    +artilharia()
  }
  class Regulamento { <<value object>> }
  class Equipe
  class Jogador
  class Fase
  class Partida {
    -estado: EstadoPartida
    -eventos: EventoPartida[]
    +registrarEvento()
    +finalizar()
    +placar()
    +vencedorId()
  }
  class EventoPartida {
    <<abstract>>
    +aplicarEm(estatisticas)
    +pontosFairPlay()
  }
  class Gol
  class Cartao { <<abstract>> }
  class CartaoAmarelo
  class CartaoVermelho
  class FormatoTorneio {
    <<interface>>
    +gerarFaseInicial()
    +gerarProximaFase()
    +campeao()
  }
  class PontosCorridos
  class MataMata
  class FaseDeGrupos
  class CriterioDesempate {
    <<abstract>>
    +encadear(proximo)
    +comparar(a, b)
    #avaliar(a, b)
  }
  class Classificacao {
    +calcular(equipes, partidas)
  }
  class ObservadorDePartida {
    <<interface>>
    +aoFinalizarPartida()
  }
  class ControleDisciplinar
  class AvancoDeFase
  class Suspensao
  class EstadoCampeonato { <<abstract>> }
  class EstadoPartida { <<abstract>> }

  Campeonato *-- Regulamento
  Campeonato *-- "*" Equipe
  Campeonato *-- "*" Fase
  Campeonato *-- "*" Suspensao
  Campeonato --> EstadoCampeonato
  Campeonato ..> FormatoTorneio : usa
  Campeonato --> "*" ObservadorDePartida : notifica
  Equipe *-- "*" Jogador
  Fase *-- "*" Partida
  Partida --> EstadoPartida
  Partida *-- "*" EventoPartida
  EventoPartida <|-- Gol
  EventoPartida <|-- Cartao
  Cartao <|-- CartaoAmarelo
  Cartao <|-- CartaoVermelho
  FormatoTorneio <|.. PontosCorridos
  FormatoTorneio <|.. MataMata
  FormatoTorneio <|.. FaseDeGrupos
  FaseDeGrupos o-- MataMata
  Classificacao --> CriterioDesempate
  CriterioDesempate --> CriterioDesempate : próximo
  ObservadorDePartida <|.. ControleDisciplinar
  ObservadorDePartida <|.. AvancoDeFase
```

---

## Regras de negócio

Cada regra tem pelo menos um teste em `backend/test/`.

| # | Regra | Onde vive | Teste |
|---|---|---|---|
| R1 | Equipe precisa ter entre o mínimo e o máximo de jogadores do regulamento | `Equipe.adicionarJogador`, `Campeonato.iniciar` | `campeonato.spec.ts` |
| R2 | Um jogador (documento) só pode estar em uma equipe por campeonato. O banco também garante isso. | `Campeonato.adicionarJogador`, `UNIQUE(campeonato_id, documento)` | `campeonato.spec.ts`, `repositorio-postgres.spec.ts` |
| R3 | Inscrições só no estado *Inscrições abertas*; depois de iniciado, o elenco fecha | `EstadoCampeonato` | `campeonato.spec.ts` |
| R4 | Pontuação configurável (padrão 3 / 1 / 0) | `PontuacaoPorResultado` | `desempate.spec.ts` |
| R5 | Pontos corridos: todos contra todos, ninguém joga duas vezes na mesma rodada | `GeradorDeRodadas` | `gerador-rodadas.spec.ts` |
| R6 | Número ímpar de equipes: uma folga por rodada, cada equipe folga uma vez | `GeradorDeRodadas` | `gerador-rodadas.spec.ts` |
| R7 | Desempate na ordem do regulamento; ordem alfabética como último critério | `CadeiaDeDesempateFactory` | `desempate.spec.ts` |
| R8 | Fair play: amarelo 1 ponto, vermelho 3; menos é melhor | `CartaoAmarelo`, `CartaoVermelho`, `CriterioFairPlay` | `desempate.spec.ts` |
| R9 | N amarelos acumulados (padrão 2) = 1 jogo de suspensão | `ControleDisciplinar` | `disciplina.spec.ts` |
| R10 | Vermelho suspende pelo número de jogos do regulamento | `ControleDisciplinar` | `disciplina.spec.ts` |
| R11 | Jogador suspenso não pode ter evento na partida em que cumpre a suspensão | `Partida.registrarEvento` | `disciplina.spec.ts`, `api.e2e.spec.ts` |
| R12 | Evento só para jogadores das duas equipes da partida | `Partida.registrarEvento` | `partida.spec.ts` |
| R13 | Mata-mata não termina empatado: exige pênaltis com vencedor | `Partida.finalizar` | `partida.spec.ts`, `campeonato.spec.ts` |
| R14 | Grupos: cruzamento 1º A × 2º B e 1º B × 2º A; equipes do mesmo grupo em lados opostos da chave | `FaseDeGrupos` | `campeonato.spec.ts` |
| R15 | Partida finalizada não aceita novos eventos | `EstadoPartida` | `partida.spec.ts` |
| R16 | Ao fim da última partida, o campeonato encerra sozinho e define o campeão | `AvancoDeFase` | `campeonato.spec.ts` |

Regras extras: o segundo amarelo na mesma partida vira vermelho automaticamente; o jogador expulso não marca mais; os amarelos de uma partida com expulsão não contam para acúmulo; a camisa é única por equipe; e o primeiro critério de classificação tem de ser PONTOS.

---

## API

Prefixo `/api`. Rotas marcadas com 🔒 exigem `Authorization: Bearer <token>` e só o organizador do campeonato pode usá-las. Toda ação devolve o campeonato completo e atualizado. Erros vêm como `{ status, erro, mensagem }`: 400 entrada inválida, 401 sem login, 403 não é o organizador, 404 não encontrado, **422 regra de negócio violada**.

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/registrar`, `/auth/login` | Cria conta / entra; devolve `{ token, usuario }` |
| GET | `/auth/eu` 🔒 | Usuário logado |
| GET | `/campeonatos` | Lista (resumo) |
| POST | `/campeonatos` 🔒 | Cria com nome, modalidade e regulamento |
| GET | `/campeonatos/:id` | Tudo: equipes, fases, partidas, tabelas, artilharia, suspensões |
| GET | `/campeonatos/:id/classificacao` · `/artilharia` · `/suspensoes` | Consultas específicas |
| POST / DELETE | `/campeonatos/:id/equipes[/:equipeId]` 🔒 | Inscreve / remove equipe |
| POST / DELETE | `/campeonatos/:id/equipes/:equipeId/jogadores[/:jogadorId]` 🔒 | Adiciona / remove jogador |
| POST | `/campeonatos/:id/iniciar` 🔒 | Fecha inscrições e gera as rodadas |
| POST | `/campeonatos/:id/partidas/:pid/iniciar` 🔒 | Começa a partida |
| POST | `/campeonatos/:id/partidas/:pid/eventos` 🔒 | `{ tipo: GOL \| CARTAO_AMARELO \| CARTAO_VERMELHO, jogadorId, minuto }` |
| DELETE | `/campeonatos/:id/partidas/:pid/eventos/:eid` 🔒 | Desfaz um lance |
| POST | `/campeonatos/:id/partidas/:pid/finalizar` 🔒 | `{ penaltisMandante?, penaltisVisitante? }` |

## Banco de dados

Onze tabelas em `backend/src/infra/persistence/postgres/migracoes/001_inicial.sql`: `usuarios`, `campeonatos`, `equipes`, `jogadores`, `fases`, `grupo_equipes`, `partidas`, `eventos_partida`, `suspensoes`, `suspensoes_cumpridas` e `migracoes` (controle). **A classificação não é gravada**: ela é sempre calculada a partir das partidas, então nunca fica inconsistente. As migrações rodam sozinhas quando a API sobe; também dá para rodá-las com `npm run db:migrate`.

---

## Roteiro sugerido da demo

1. Entre com a conta demo e abra a **Copa Interclasses 2026**: tabela por grupo, rodadas 1 e 2 já jogadas e um jogador suspenso.
2. Abra uma partida da rodada 3, inicie, registre gols e um segundo amarelo (vira vermelho automaticamente) e finalize. A tabela e as suspensões mudam na hora.
3. Tente registrar um lance para o jogador suspenso e mostre a mensagem da regra R11.
4. Termine a rodada 3 e veja a semifinal ser gerada com o cruzamento 1º A × 2º B.
5. Abra o **Torneio Relâmpago** para mostrar o chaveamento completo com pênaltis e o campeão.
6. Na **Liga de Society** (inscrições abertas), inscreva uma equipe, tente iniciar sem elenco mínimo (R1) e repita um documento (R2).
7. No código: siga a tabela "Onde está cada conceito de POO" e rode `npm run test:cov` ao vivo.

## Trabalho em equipe no GitHub

- `main` protegida: só entra código por pull request revisado e com o CI verde.
- Uma branch por tarefa (`feat/desempate-confronto-direto`, `fix/suspensao-vermelho`) e commits no padrão `feat:`, `fix:`, `test:`, `docs:`.
- O professor cobra atividade semanal: cada membro deve abrir pelo menos um PR por semana.

### Ideias para evoluir (boas tarefas para dividir)

- Agendar data, hora e local das partidas
- Outros esportes com pontuação própria (vôlei por sets) implementando `RegraPontuacao`
- Novo critério de desempate (ex.: menos gols sofridos): é só criar uma subclasse de `CriterioDesempate`
- Notificação ao finalizar partida: um novo `ObservadorDePartida`
- Exportar a tabela em PDF; atualização em tempo real via WebSocket
- Deploy: backend no Render/Railway e frontend na Vercel (`VITE_API_URL`)
