-- Esquema inicial do Gestor de Campeonatos.
-- A classificação NÃO é gravada: ela é calculada a partir das partidas.

CREATE TABLE usuarios (
  id          UUID PRIMARY KEY,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campeonatos (
  id                        UUID PRIMARY KEY,
  nome                      TEXT NOT NULL,
  descricao                 TEXT NOT NULL DEFAULT '',
  modalidade                TEXT NOT NULL,
  organizador_id            UUID NOT NULL REFERENCES usuarios(id),
  status                    TEXT NOT NULL CHECK (status IN ('INSCRICOES_ABERTAS', 'EM_ANDAMENTO', 'ENCERRADO')),
  campeao_id                UUID,
  formato                   TEXT NOT NULL CHECK (formato IN ('PONTOS_CORRIDOS', 'MATA_MATA', 'GRUPOS_E_MATA_MATA')),
  min_jogadores             INT NOT NULL,
  max_jogadores             INT NOT NULL,
  pontos_vitoria            INT NOT NULL,
  pontos_empate             INT NOT NULL,
  pontos_derrota            INT NOT NULL,
  criterios_desempate       TEXT[] NOT NULL,
  ida_e_volta               BOOLEAN NOT NULL,
  numero_grupos             INT NOT NULL,
  amarelos_para_suspensao   INT NOT NULL,
  jogos_suspensao_vermelho  INT NOT NULL,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE equipes (
  id              UUID PRIMARY KEY,
  campeonato_id   UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  ordem           INT NOT NULL,
  UNIQUE (campeonato_id, nome)
);

CREATE TABLE jogadores (
  id              UUID PRIMARY KEY,
  equipe_id       UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  campeonato_id   UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  numero          INT NOT NULL CHECK (numero BETWEEN 1 AND 99),
  documento       TEXT NOT NULL,
  posicao         TEXT,
  ordem           INT NOT NULL,
  UNIQUE (equipe_id, numero),
  -- R2 também garantida pelo banco: um documento por campeonato
  UNIQUE (campeonato_id, documento)
);

CREATE TABLE fases (
  id              UUID PRIMARY KEY,
  campeonato_id   UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('PONTOS_CORRIDOS', 'GRUPOS', 'MATA_MATA')),
  ordem           INT NOT NULL,
  UNIQUE (campeonato_id, ordem)
);

CREATE TABLE grupo_equipes (
  fase_id     UUID NOT NULL REFERENCES fases(id) ON DELETE CASCADE,
  grupo       TEXT NOT NULL,
  equipe_id   UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  ordem       INT NOT NULL,
  PRIMARY KEY (fase_id, equipe_id)
);

CREATE TABLE partidas (
  id                  UUID PRIMARY KEY,
  fase_id             UUID NOT NULL REFERENCES fases(id) ON DELETE CASCADE,
  rodada              INT NOT NULL,
  grupo               TEXT,
  posicao             INT NOT NULL,
  mandante_id         UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  visitante_id        UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  eliminatoria        BOOLEAN NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('AGENDADA', 'EM_ANDAMENTO', 'FINALIZADA')),
  penaltis_mandante   INT,
  penaltis_visitante  INT,
  CHECK (mandante_id <> visitante_id)
);

CREATE TABLE eventos_partida (
  id                UUID PRIMARY KEY,
  partida_id        UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id        UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  equipe_id         UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL CHECK (tipo IN ('GOL', 'CARTAO_AMARELO', 'CARTAO_VERMELHO')),
  minuto            INT NOT NULL,
  segundo_amarelo   BOOLEAN NOT NULL DEFAULT false,
  ordem             INT NOT NULL
);

CREATE TABLE suspensoes (
  id                  UUID PRIMARY KEY,
  campeonato_id       UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  jogador_id          UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  equipe_id           UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  motivo              TEXT NOT NULL CHECK (motivo IN ('ACUMULO_DE_AMARELOS', 'CARTAO_VERMELHO')),
  partida_origem_id   UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogos               INT NOT NULL,
  ordem               INT NOT NULL
);

CREATE TABLE suspensoes_cumpridas (
  suspensao_id  UUID NOT NULL REFERENCES suspensoes(id) ON DELETE CASCADE,
  partida_id    UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  ordem         INT NOT NULL,
  PRIMARY KEY (suspensao_id, partida_id)
);

CREATE INDEX idx_partidas_fase ON partidas(fase_id);
CREATE INDEX idx_eventos_partida ON eventos_partida(partida_id);
