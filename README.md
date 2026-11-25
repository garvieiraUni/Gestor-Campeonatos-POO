# Gestor de Campeonatos

Sistema web para organizar campeonatos esportivos. Qualquer pessoa cria uma conta, monta o seu campeonato, convida outras contas para ajudar a organizar e escolhe quem pode ver e se inscrever. Os organizadores preenchem a súmula de cada partida e **a classificação, o chaveamento, a artilharia e as suspensões são calculados automaticamente pelo backend**.

Projeto da disciplina de Programação Orientada a Objetos: backend em TypeScript projetado com POO, frontend React que conversa com a API e testes automatizados para todas as regras de negócio.

| | |
|---|---|
| **Backend** | Node.js 22 · NestJS 11 · TypeScript |
| **Banco** | PostgreSQL 16 (SQL puro com `pg`) ou repositório em memória |
| **Frontend** | React 18 · Vite · TanStack Query · Tailwind CSS |
| **Testes** | Jest · Supertest (123 testes: unitários, e2e e integração com Postgres real) |
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

A API sobe com **dados de demonstração** (quatro campeonatos e três contas). No modo memória, os dados somem quando a API reinicia.

| Conta demo | E-mail / senha | Para mostrar |
|---|---|---|
| Organizador | `demo@campeonatos.dev` / `demo123` | Criador dos quatro campeonatos |
| Torcedor (espectador) | `torcedor@campeonatos.dev` / `torcedor123` | Tem um convite para organizar a Copa e um time aguardando aprovação na Liga |
| ADM do site | `adm@campeonatos.dev` / `adm123` | Vê e altera qualquer campeonato, inclusive o privado |

### Com PostgreSQL

```bash
docker compose up -d                  # sobe o Postgres
cd backend
cp .env.example .env                  # troque PERSISTENCIA=memoria por PERSISTENCIA=postgres e defina JWT_SECRET
npm run dev                           # aplica as migrações sozinho e cria os dados de demo
npm run adm:promover -- email@exemplo.com   # transforma uma conta existente em ADM do site
```

Com `PERSISTENCIA=postgres` a API **se recusa a subir sem `JWT_SECRET`**: um segredo padrão deixaria qualquer um forjar tokens, inclusive de ADM.

### Testes

```bash
cd backend
npm test                  # unitários + e2e (não precisam de banco)
npm run test:cov          # com relatório de cobertura (coverage/lcov-report/index.html)

# testes de integração com o Postgres do docker-compose:
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/campeonatos_test npm run test:integracao
```

---

## Papéis e permissões

Há dois níveis de papel, e os dois são classes do domínio.

**No site** (`PapelNoSite`): toda conta nasce **Padrão**. A conta **ADM** (desenvolvedores) tem acesso global a todos os campeonatos; ela só é criada pelo seed ou pelo script `adm:promover`, nunca pelo cadastro.

**Em cada campeonato** (`PapelNoCampeonato`), calculado pela `PoliticaDeAcesso` a cada requisição:

| Ação | Visitante (sem login) | Espectador (logado) | Organizador convidado | Criador | ADM do site |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver o campeonato | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inscrever o próprio time (se o modo permitir) | | ✓ | | | |
| Inscrever, editar, aprovar e recusar times | | | ✓ | ✓ | ✓ |
| Preencher a súmula · iniciar o campeonato | | | ✓ | ✓ | ✓ |
| Alterar o regulamento (só antes do início) | | | ✓ | ✓ | ✓ |
| Banir contas | | | ✓ | ✓ | ✓ |
| Nome, descrição, visibilidade, modo de inscrição, link de acesso | | | | ✓ | ✓ |
| Convidar e remover organizadores | | | | ✓ | ✓ |
| Excluir o campeonato | | | | ✓ | ✓ |

Quem foi **banido de ver**, ou não tem o link de um campeonato **privado**, fica `Bloqueado` e recebe **404**, para o campeonato privado não revelar que existe.

### Visibilidade e modo de inscrição (independentes; só o criador muda, a qualquer momento)

| Visibilidade | Efeito |
|---|---|
| **Pública** | Aparece na lista do site; qualquer um acompanha. |
| **Privada** | Fora da lista. Só veem os organizadores, o ADM, quem já tem time inscrito e quem abre o **link de acesso** (`/campeonatos/:id?chave=...`). O criador pode gerar um link novo, o que invalida o antigo. |

| Modo de inscrição | Efeito |
|---|---|
| **Aberta livre** | O espectador logado inscreve o seu time (com o elenco completo) e ele entra na hora. |
| **Aberta com permissão** | O time fica **pendente** até um organizador aprovar ou recusar (com motivo). |
| **Fechada** | Só os organizadores inscrevem times. |

Um campeonato **privado com inscrições abertas** mostra um aviso aos organizadores: só quem tiver o link consegue se inscrever.

---

## Arquitetura

O backend é organizado em camadas, e **as dependências sempre apontam para o domínio**: o domínio não importa nada de NestJS, HTTP ou banco. Por isso as regras rodam e são testadas em milissegundos, sem subir servidor nenhum.

```
frontend (React)  ──HTTP/JSON + JWT + X-Chave-Acesso──▶  infra/http (guards, controllers, DTOs, apresentador)
                                                              │  o guard recarrega a conta e monta o Ator
                                                              ▼
                                                        application (casos de uso: Template Method)
                                                              │  1. carrega o Campeonato
                                                              │  2. PoliticaDeAcesso.exigir(ator, campeonato, acao)
                                                              │  3. aplica a regra no agregado
                                                              │  4. salva (com lock otimista)
                                                              ▼
                                                        domain (entidades, papéis, estratégias)  ◀── infra/persistence
                                                                                                    (memória ou PostgreSQL)
```

**Quem pode fazer o quê** fica só na `PoliticaDeAcesso`; **as regras do jogo e da inscrição** ficam só no `Campeonato`. Nenhum dos dois conhece o outro: o caso de uso junta os dois. A resposta de toda ação traz `meuPapel` e `permissoes`, e o frontend só decide o que mostrar a partir delas, sem comparar ids.

```
gestor-campeonatos/
├── backend/
│   ├── src/
│   │   ├── domain/                    ← o coração do projeto (POO pura)
│   │   │   ├── acesso/                PapelNoSite, Ator, PapelNoCampeonato (cadeia de herança), PoliticaDeAcesso
│   │   │   ├── configuracao/          Visibilidade + ChaveDeAcesso, ModoDeInscricao (Strategies)
│   │   │   ├── organizacao/           Convite (abstrata) → ConvitePorEmail, ConvitePorLink; Banimento
│   │   │   ├── entidades/             Campeonato, Equipe, Jogador, Partida, Fase, Regulamento, Usuario + States
│   │   │   ├── eventos/               EventoPartida (abstrata) → Gol, CartaoAmarelo, CartaoVermelho
│   │   │   ├── formatos/              FormatoTorneio (interface) → PontosCorridos, MataMata, FaseDeGrupos
│   │   │   ├── desempate/             CriterioDesempate (Chain of Responsibility), Classificacao
│   │   │   ├── pontuacao/             RegraPontuacao (Strategy)
│   │   │   ├── disciplina/            Suspensao, ObservadorDePartida (Observer)
│   │   │   ├── repositorios/          interfaces CampeonatoRepository, UsuarioRepository
│   │   │   └── compartilhado/         hierarquia de erros, ids e chaves
│   │   ├── application/
│   │   │   ├── casos-de-uso/          base (Template Method), campeonatos, inscricoes, organizacao, configuracao, auth
│   │   │   └── portas/                hash e token
│   │   ├── infra/
│   │   │   ├── http/                  controllers, DTOs, guards (login obrigatório/opcional), filtro de erros, apresentador
│   │   │   ├── persistence/           memoria/ e postgres/ (SQL, migrações, repositórios, script adm:promover)
│   │   │   ├── seguranca/             bcrypt e JWT
│   │   │   └── seed/                  dados de demonstração
│   │   ├── app.module.ts              composição: liga cada interface à sua implementação
│   │   └── main.ts
│   └── test/
│       ├── unit/domain/               regras de negócio, papéis, convites, inscrições (sem banco, sem HTTP)
│       ├── e2e/                       API inteira via HTTP, com várias contas
│       ├── integracao/                repositório contra PostgreSQL real
│       └── builders/                  CampeonatoBuilder e helpers de teste
├── frontend/src/
│   ├── pages/                         Campeonatos, Entrar, NovoCampeonato, PainelCampeonato, Sumula, Convites
│   ├── components/                    competição, equipes, inscrição do espectador, fila de inscrições,
│   │                                  organização, configurações, editor de regulamento, UI
│   ├── api/                           cliente axios (token + chave de acesso), hooks do TanStack Query, tipos
│   └── auth/                          contexto de login
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Onde está cada conceito de POO (roteiro para o tour do código)

| Conceito | Onde ver | O que mostrar |
|---|---|---|
| **Encapsulamento** | `domain/entidades/campeonato.ts` | Listas privadas (`_equipes`, `_organizadores`, `_convites`) expostas como `readonly`; toda mudança passa por métodos que validam as regras. |
| **Herança em cadeia + Liskov** | `domain/acesso/papel-no-campeonato.ts` | `Visitante → Espectador → OrganizadorConvidado → Criador → AdministradorGlobal`. Cada papel só **acrescenta** permissões (`super.permissoes()`), então qualquer um pode substituir o anterior. Há um teste que confere isso. |
| **Herança + classe abstrata** | `domain/eventos/evento-partida.ts`, `domain/organizacao/convite.ts` | `EventoPartida` → `Gol`, `Cartao`…; `Convite` → `ConvitePorEmail`, `ConvitePorLink`. |
| **Polimorfismo** | `Partida.estatisticas()`, `Convite.aceitar()`, `PapelNoSite.temAcessoGlobal()` | Nenhum `if` por tipo: cada evento sabe seu efeito, cada convite sabe quem pode aceitá-lo, cada papel sabe se tem acesso global. |
| **Interfaces** | `formatos/formato-torneio.ts`, `repositorios/repositorios.ts` | O Campeonato só conhece `FormatoTorneio`; os casos de uso só conhecem `CampeonatoRepository`. |
| **Strategy** | `formatos/`, `pontuacao/`, `configuracao/visibilidade.ts`, `configuracao/modo-inscricao.ts` | Formatos e pontuação trocáveis; `Publica`/`Privada` decidem quem vê; `InscricaoLivre`/`ComAprovacao`/`Fechada` decidem o estado inicial do time do espectador. |
| **Chain of Responsibility** | `desempate/criterios.ts` | Cada `CriterioDesempate` tenta separar duas equipes e, se empatar, passa para o próximo elo. |
| **State** | `estado-partida.ts`, `estado-campeonato.ts`, `estado-inscricao.ts` | Partida, campeonato e **inscrição do time** (`Pendente → Aprovada / Recusada → reenviar`): cada estado libera só as ações válidas. |
| **Observer** | `disciplina/observadores.ts` | Ao finalizar uma partida, `ControleDisciplinar` cuida das suspensões e `AvancoDeFase` gera a próxima fase. |
| **Template Method** | `application/casos-de-uso/base.ts`, `Convite.aceitar`, `PapelNoCampeonato.pode` | `CasoDeUsoNoCampeonato` fixa "carregar → exigir permissão → aplicar → persistir"; cada caso de uso só declara a `acao` exigida e implementa `aplicar`. O `ExcluirCampeonato` redefine só o gancho `persistir`. |
| **Serviço de domínio** | `domain/acesso/politica-de-acesso.ts` | Uma regra que não pertence a nenhuma entidade sozinha (envolve conta, campeonato, visibilidade e banimentos) vira uma classe própria. |
| **Factory** | `FormatoFactory`, `EventoFactory`, `ConviteFactory`, `PapelNoSite.de`, `Visibilidade.de`, `ModoDeInscricao.de` | Criam a subclasse certa a partir de um tipo vindo da API ou do banco. |
| **Composição** | `formatos/fase-de-grupos.ts` | `FaseDeGrupos` *tem um* `MataMata` e reaproveita o chaveamento sem herdar dele. |
| **Value Object** | `Regulamento`, `Ator`, `ChaveDeAcesso`, `Banimento` | Imutáveis e validados na criação. Para "mudar" o regulamento, o Campeonato troca o objeto inteiro por um novo, validado do zero. |
| **Inversão de dependência** | `app.module.ts` | Troca memória ↔ PostgreSQL com uma variável de ambiente, sem mudar uma linha do domínio. |
| **Repository + lock otimista** | `infra/persistence/` | Duas implementações da mesma interface; ambas conferem a `versao` do agregado e recusam a gravação (409) se outra pessoa salvou antes. |

### Diagrama de classes (domínio)

```mermaid
classDiagram
  direction LR
  class Campeonato {
    -criadorId
    -organizadores: Id[]
    -visibilidade: Visibilidade
    -modoInscricao: ModoDeInscricao
    -convites: Convite[]
    -banimentos: Banimento[]
    -versao
    +solicitarInscricao(conta, time)
    +aprovarInscricao() / recusarInscricao(motivo)
    +convidarPorEmail() / gerarLinkDeConvite()
    +aceitarConvite(convite, conta)
    +banir(conta, nivel)
    +alterarRegulamento(parcial)
    +iniciar()
    +finalizarPartida()
  }
  class PoliticaDeAcesso {
    +papelDe(ator, campeonato, chave)
    +exigir(ator, campeonato, acao)
  }
  class Ator { <<value object>> }
  class PapelNoSite { <<abstract>> +temAcessoGlobal() }
  class Administrador
  class ContaPadrao
  class PapelNoCampeonato { <<abstract>> +pode(acao) #permissoes() }
  class Bloqueado
  class Visitante
  class Espectador
  class OrganizadorConvidado
  class Criador
  class AdministradorGlobal
  class Visibilidade { <<abstract>> +permiteVer() }
  class Publica
  class Privada
  class ModoDeInscricao { <<abstract>> +estadoInicialParaEspectador() }
  class InscricaoLivre
  class InscricaoComAprovacao
  class InscricaoFechada
  class EstadoInscricao { <<abstract>> }
  class Convite { <<abstract>> +aceitar(conta) #podeSerAceitoPor() }
  class ConvitePorEmail
  class ConvitePorLink
  class Banimento { <<value object>> }
  class Equipe
  class Fase
  class Partida
  class Regulamento { <<value object>> }
  class FormatoTorneio { <<interface>> }
  class ObservadorDePartida { <<interface>> }

  PoliticaDeAcesso ..> Ator
  PoliticaDeAcesso ..> Campeonato
  PoliticaDeAcesso ..> PapelNoCampeonato : cria
  Ator --> PapelNoSite
  PapelNoSite <|-- Administrador
  PapelNoSite <|-- ContaPadrao
  PapelNoCampeonato <|-- Bloqueado
  PapelNoCampeonato <|-- Visitante
  Visitante <|-- Espectador
  Espectador <|-- OrganizadorConvidado
  OrganizadorConvidado <|-- Criador
  Criador <|-- AdministradorGlobal
  Campeonato --> Visibilidade
  Campeonato --> ModoDeInscricao
  Visibilidade <|-- Publica
  Visibilidade <|-- Privada
  ModoDeInscricao <|-- InscricaoLivre
  ModoDeInscricao <|-- InscricaoComAprovacao
  ModoDeInscricao <|-- InscricaoFechada
  Campeonato *-- "*" Convite
  Convite <|-- ConvitePorEmail
  Convite <|-- ConvitePorLink
  Campeonato *-- "*" Banimento
  Campeonato *-- Regulamento
  Campeonato *-- "*" Equipe
  Equipe --> EstadoInscricao
  Campeonato *-- "*" Fase
  Fase *-- "*" Partida
  Campeonato ..> FormatoTorneio : usa
  Campeonato --> "*" ObservadorDePartida : notifica
```

---

## Regras de negócio

Cada regra tem pelo menos um teste em `backend/test/`.

| # | Regra | Onde vive | Teste |
|---|---|---|---|
| R1 | Equipe precisa ter entre o mínimo e o máximo de jogadores do regulamento | `Equipe.adicionarJogador`, `Campeonato.iniciar`, `Campeonato.solicitarInscricao` | `campeonato.spec.ts`, `inscricoes.spec.ts` |
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
| R17 | Espectador logado inscreve **um time por conta**, enviado de uma vez com o elenco completo; depois do envio só os organizadores editam. O banco também garante "um time por conta". | `Campeonato.solicitarInscricao`, índice `equipes_um_time_por_conta` | `inscricoes.spec.ts`, `papeis.e2e.spec.ts` |
| R18 | O regulamento pode ser alterado pelos organizadores **só antes do início**, e o novo regulamento não pode deixar um time acima do máximo | `Campeonato.alterarRegulamento` | `inscricoes.spec.ts`, `papeis.e2e.spec.ts` |
| R19 | O modo de inscrição decide se o time do espectador entra aprovado, fica pendente ou é recusado; inscrições pendentes **impedem o início** | `ModoDeInscricao`, `Campeonato.iniciar` | `inscricoes.spec.ts` |
| R20 | Recusa exige motivo; o espectador vê o motivo e pode **reenviar** o time corrigido. Times recusados saem quando o campeonato começa | `EstadoInscricao`, `Campeonato.reenviarInscricao` | `inscricoes.spec.ts`, `papeis.e2e.spec.ts` |
| R21 | Organizadores banem contas de **inscrever** times ou, num nível acima, também de **ver** o campeonato. Banir recusa o time pendente da conta; organizadores não podem ser banidos | `Campeonato.banir`, `Banimento` | `inscricoes.spec.ts`, `papeis.e2e.spec.ts` |
| R22 | Convite por **e-mail** (só a conta convidada aceita ou recusa, uma vez) ou por **link** (qualquer conta logada, até ser revogado) | `Convite` e subclasses | `organizacao.spec.ts`, `papeis.e2e.spec.ts` |
| R23 | Só o criador gerencia os organizadores; o criador não pode ser removido nem sair; convidados podem sair | `Campeonato.removerOrganizador`, `PapelNoCampeonato` | `organizacao.spec.ts` |
| R24 | Campeonato privado só é visto por quem participa ou tem o link; para os demais responde 404 | `Privada`, `PoliticaDeAcesso` | `acesso.spec.ts`, `papeis.e2e.spec.ts` |
| R25 | Duas pessoas alterando o mesmo campeonato ao mesmo tempo: a segunda gravação é recusada (409) em vez de apagar a primeira | repositórios (lock otimista) | `organizacao.spec.ts`, `repositorio-postgres.spec.ts` |
| R26 | Documento dos jogadores é dado pessoal: só a organização e o responsável pelo time veem | `CampeonatoApresentador` | `papeis.e2e.spec.ts` |

Regras extras: o segundo amarelo na mesma partida vira vermelho automaticamente; o jogador expulso não marca mais; os amarelos de uma partida com expulsão não contam para acúmulo; a camisa é única por equipe; e o primeiro critério de classificação tem de ser PONTOS.

**Limitação conhecida:** banir de "ver" bloqueia a **conta**. Como campeonatos públicos podem ser vistos sem login, a pessoa ainda consegue vê-los deslogada.

---

## API

Prefixo `/api`. 🔒 = exige `Authorization: Bearer <token>`. 👁 = login opcional (sem login, a pessoa é visitante). Para campeonatos privados, o frontend envia a chave do link no cabeçalho `X-Chave-Acesso`. A permissão de cada rota é conferida pela `PoliticaDeAcesso` (veja a matriz acima). Erros vêm como `{ status, erro, mensagem }`: 400 entrada inválida, 401 sem login, 403 sem permissão, 404 não encontrado (ou privado sem acesso), **409 conflito de versão**, **422 regra de negócio violada**.

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/registrar`, `/auth/login` | Cria conta / entra; devolve `{ token, usuario: { ..., papel } }` |
| GET | `/auth/eu` 🔒 | Conta logada |
| GET | `/campeonatos` 👁 | Lista: públicos + os privados de que a pessoa participa (o ADM vê todos) |
| POST | `/campeonatos` 🔒 | Cria com nome, modalidade, regulamento, `visibilidade` e `modoInscricao` |
| GET | `/campeonatos/:id` 👁 | Tudo, filtrado pelo papel: equipes, fases, tabelas, artilharia, suspensões, `meuPapel`, `permissoes`, `avisos` |
| GET | `/campeonatos/:id/classificacao` · `/artilharia` · `/suspensoes` 👁 | Consultas específicas |
| PATCH | `/campeonatos/:id` 🔒 | Nome, descrição, modalidade, visibilidade e modo de inscrição (criador) |
| PATCH | `/campeonatos/:id/regulamento` 🔒 | Altera o regulamento antes do início (organizadores) |
| POST | `/campeonatos/:id/chave-de-acesso` 🔒 | Gera um novo link de acesso (criador) |
| DELETE | `/campeonatos/:id` 🔒 | Exclui (criador) |
| POST / DELETE | `/campeonatos/:id/equipes[/:equipeId]` 🔒 | Inscreve / remove equipe (organizadores) |
| POST / DELETE | `/campeonatos/:id/equipes/:equipeId/jogadores[/:jogadorId]` 🔒 | Adiciona / remove jogador (organizadores) |
| POST | `/campeonatos/:id/equipes/:equipeId/aprovar` · `/recusar` 🔒 | Aprova ou recusa (`{ motivo }`) uma inscrição |
| POST | `/campeonatos/:id/inscricao` 🔒 | Espectador inscreve o próprio time: `{ nome, jogadores: [...] }` |
| POST | `/campeonatos/:id/inscricao/reenviar` 🔒 | Reenvia uma inscrição recusada |
| POST | `/campeonatos/:id/convites` · `/convites/link` 🔒 | Convida por e-mail (`{ email }`) ou gera link (criador) |
| DELETE | `/campeonatos/:id/convites/:conviteId` 🔒 | Revoga um convite |
| POST | `/campeonatos/:id/convites/:conviteId/aceitar` · `/recusar` 🔒 | O convidado responde a um convite por e-mail |
| DELETE | `/campeonatos/:id/organizadores/:usuarioId` 🔒 | Remove um organizador (criador) |
| POST | `/campeonatos/:id/organizadores/sair` 🔒 | O organizador convidado sai |
| POST / DELETE | `/campeonatos/:id/banimentos[/:usuarioId]` 🔒 | Bane (`{ usuarioId, nivel: INSCRICAO \| VISUALIZACAO, motivo? }`) / desbane |
| GET | `/convites` 🔒 | Meus convites por e-mail pendentes |
| GET / POST | `/convites/link/:token` · `/convites/link/:token/aceitar` 🔒 | Prévia / aceite de um convite por link |
| POST | `/campeonatos/:id/iniciar` 🔒 | Fecha inscrições e gera as rodadas |
| POST | `/campeonatos/:id/partidas/:pid/iniciar` 🔒 | Começa a partida |
| POST | `/campeonatos/:id/partidas/:pid/eventos` 🔒 | `{ tipo: GOL \| CARTAO_AMARELO \| CARTAO_VERMELHO, jogadorId, minuto }` |
| DELETE | `/campeonatos/:id/partidas/:pid/eventos/:eid` 🔒 | Desfaz um lance |
| POST | `/campeonatos/:id/partidas/:pid/finalizar` 🔒 | `{ penaltisMandante?, penaltisVisitante? }` |

## Banco de dados

Migrações em `backend/src/infra/persistence/postgres/migracoes/`, aplicadas sozinhas quando a API sobe (ou com `npm run db:migrate`):

- `001_inicial.sql`: `usuarios`, `campeonatos`, `equipes`, `jogadores`, `fases`, `grupo_equipes`, `partidas`, `eventos_partida`, `suspensoes`, `suspensoes_cumpridas` e `migracoes` (controle).
- `002_papeis_e_acesso.sql`: `usuarios.papel`; em `campeonatos`, `organizador_id` vira `criador_id` e entram `visibilidade`, `modo_inscricao`, `chave_acesso` e `versao`; em `equipes`, `responsavel_id`, `status_inscricao` e `motivo_recusa`; tabelas novas `campeonato_organizadores`, `convites`, `convite_aceites` e `banimentos`.

**A classificação não é gravada**: ela é sempre calculada a partir das partidas, então nunca fica inconsistente. Cada gravação do campeonato confere e incrementa `versao` (lock otimista).

---

## Roteiro sugerido da demo

1. **Visitante:** abra o site sem login. O "Racha dos Amigos" (privado) não aparece na lista.
2. **Torcedor** (`torcedor@campeonatos.dev`): o menu mostra **Convites (1)**. Na **Liga de Society**, o time "Direito da Bola" aparece como *aguardando aprovação*, e os documentos dos outros times não aparecem.
3. **Organizador** (`demo@campeonatos.dev`): na Liga, aba **Inscrições**, recuse o time com um motivo. Volte como torcedor, veja o motivo, corrija e reenvie. Aprove como organizador.
4. Tente **iniciar** a Liga com uma inscrição pendente (R19) e mostre a mensagem.
5. Na **Copa Interclasses**, como torcedor, aceite o convite: agora ele é **Organizador** e preenche a súmula da rodada 3, mas não vê a aba de configurações do criador nem consegue remover o criador.
6. No **Racha**, aba **Configurações**: mostre o aviso de privado com inscrições abertas, copie o **link de acesso** e abra-o numa janela anônima. Gere um link novo e mostre que o antigo deixou de funcionar.
7. Aba **Organização** → **Convidar**: mostre as duas opções (e-mail e link).
8. **ADM** (`adm@campeonatos.dev`): o Racha aparece na lista e ele pode alterar ou excluir qualquer campeonato.
9. Partes antigas que continuam valendo: segundo amarelo vira vermelho, jogador suspenso (R11), semifinal gerada com o cruzamento 1º A × 2º B, o **Torneio Relâmpago** com pênaltis e campeão.
10. No código: siga a tabela "Onde está cada conceito de POO", mostre a cadeia de papéis e a `PoliticaDeAcesso`, e rode `npm run test:cov` ao vivo.

## Trabalho em equipe no GitHub

- `main` protegida: só entra código por pull request revisado e com o CI verde.
- Uma branch por tarefa (`feat/desempate-confronto-direto`, `fix/suspensao-vermelho`) e commits no padrão `feat:`, `fix:`, `test:`, `docs:`.
- O professor cobra atividade semanal: cada membro deve abrir pelo menos um PR por semana.

### Ideias para evoluir (boas tarefas para dividir)

- Agendar data, hora e local das partidas
- Outros esportes com pontuação própria (vôlei por sets) implementando `RegraPontuacao`
- Novo critério de desempate (ex.: menos gols sofridos): é só criar uma subclasse de `CriterioDesempate`
- Notificação ao finalizar partida ou ao receber um convite: um novo `ObservadorDePartida` / envio de e-mail
- Expiração e limite de usos para convites por link (uma nova subclasse de `Convite`)
- Exportar a tabela em PDF; atualização em tempo real via WebSocket
- Deploy: backend no Render/Railway e frontend na Vercel (`VITE_API_URL`)
