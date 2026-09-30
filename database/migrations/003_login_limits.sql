-- Janelas persistidas: reiniciar a API não libera novas tentativas.
-- A chave contém SHA-256 do IP/login, nunca a credencial em texto aberto.
CREATE TABLE login_limits (
  key text PRIMARY KEY CHECK (key ~ '^(ip|login):[a-f0-9]{64}$'),
  attempts integer NOT NULL CHECK (attempts > 0),
  resets_at timestamptz NOT NULL
);
CREATE INDEX login_limits_reset_idx ON login_limits(resets_at);
