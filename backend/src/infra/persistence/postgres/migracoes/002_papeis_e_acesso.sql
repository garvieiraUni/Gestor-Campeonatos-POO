-- Papéis no site, organização compartilhada, visibilidade, modos de inscrição e lock otimista.

ALTER TABLE usuarios
  ADD COLUMN papel TEXT NOT NULL DEFAULT 'PADRAO' CHECK (papel IN ('ADM', 'PADRAO'));

ALTER TABLE campeonatos RENAME COLUMN organizador_id TO criador_id;
ALTER TABLE campeonatos
  ADD COLUMN visibilidade   TEXT NOT NULL DEFAULT 'PUBLICA' CHECK (visibilidade IN ('PUBLICA', 'PRIVADA')),
  ADD COLUMN modo_inscricao TEXT NOT NULL DEFAULT 'FECHADA' CHECK (modo_inscricao IN ('LIVRE', 'COM_APROVACAO', 'FECHADA')),
  ADD COLUMN chave_acesso   TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  -- lock otimista: cada gravação confere e incrementa
  ADD COLUMN versao         INT  NOT NULL DEFAULT 1;

-- organizadores convidados (o criador fica em campeonatos.criador_id)
CREATE TABLE campeonato_organizadores (
  campeonato_id  UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ordem          INT  NOT NULL,
  PRIMARY KEY (campeonato_id, usuario_id)
);

CREATE TABLE convites (
  id             UUID PRIMARY KEY,
  campeonato_id  UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('EMAIL', 'LINK')),
  email          TEXT,
  token          TEXT UNIQUE,
  status         TEXT NOT NULL CHECK (status IN ('PENDENTE', 'ACEITO', 'RECUSADO', 'REVOGADO')),
  criado_por     UUID NOT NULL REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL,
  ordem          INT  NOT NULL,
  CHECK ((tipo = 'EMAIL' AND email IS NOT NULL) OR (tipo = 'LINK' AND token IS NOT NULL))
);
CREATE INDEX idx_convites_email_pendente ON convites (email) WHERE status = 'PENDENTE';

CREATE TABLE convite_aceites (
  convite_id  UUID NOT NULL REFERENCES convites(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ordem       INT  NOT NULL,
  PRIMARY KEY (convite_id, usuario_id)
);

CREATE TABLE banimentos (
  campeonato_id  UUID NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nivel          TEXT NOT NULL CHECK (nivel IN ('INSCRICAO', 'VISUALIZACAO')),
  motivo         TEXT NOT NULL DEFAULT '',
  banido_por     UUID NOT NULL REFERENCES usuarios(id),
  banido_em      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (campeonato_id, usuario_id)
);

ALTER TABLE equipes
  ADD COLUMN responsavel_id   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN status_inscricao TEXT NOT NULL DEFAULT 'APROVADA' CHECK (status_inscricao IN ('PENDENTE', 'APROVADA', 'RECUSADA')),
  ADD COLUMN motivo_recusa    TEXT,
  ADD CHECK ((status_inscricao = 'RECUSADA') = (motivo_recusa IS NOT NULL));

-- R17 também garantida pelo banco: um time por conta em cada campeonato
CREATE UNIQUE INDEX equipes_um_time_por_conta ON equipes (campeonato_id, responsavel_id) WHERE responsavel_id IS NOT NULL;
