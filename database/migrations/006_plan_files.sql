-- Metadados privados; os bytes ficam no volume FILES_DIR, sem caminhos do cliente.
CREATE TABLE plan_files (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('original','rendered')),
  media_type text NOT NULL CHECK (media_type IN ('image/png','image/jpeg','application/pdf')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  original_id uuid,
  page integer CHECK (page BETWEEN 1 AND 100),
  width integer CHECK (width BETWEEN 1 AND 8192),
  height integer CHECK (height BETWEEN 1 AND 8192),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,plan_id,id),
  FOREIGN KEY(company_id,plan_id) REFERENCES plans(company_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,plan_id,original_id) REFERENCES plan_files(company_id,plan_id,id) ON DELETE RESTRICT,
  CHECK ((kind='original' AND original_id IS NULL AND page IS NULL AND width IS NULL AND height IS NULL)
    OR (kind='rendered' AND original_id IS NOT NULL AND media_type='image/png' AND width IS NOT NULL AND height IS NOT NULL)),
  CHECK (width::bigint * height::bigint <= 16000000)
);
CREATE INDEX plan_files_plan ON plan_files(company_id,plan_id);

-- Integridade também para gravações SQL fora da API, sem depender do renderizador.
CREATE FUNCTION check_plan_background_files() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b jsonb;
BEGIN
  b := NEW.geometry->'background';
  IF b IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM plan_files r JOIN plan_files o ON o.id=r.original_id
    WHERE r.company_id=NEW.company_id AND r.plan_id=NEW.id AND r.kind='rendered'
      AND o.company_id=NEW.company_id AND o.plan_id=NEW.id AND o.kind='original'
      AND o.id::text=lower(b->>'originalFileId') AND r.id::text=lower(b->>'renderedFileId')
      AND r.page IS NOT DISTINCT FROM (b->>'page')::integer
      AND r.width=(b->>'sourceWidthPx')::integer AND r.height=(b->>'sourceHeightPx')::integer
  ) THEN RAISE EXCEPTION 'Referências de fundo inválidas' USING ERRCODE='23514'; END IF;
  IF b ? 'opacity' AND NOT coalesce(jsonb_typeof(b->'opacity')='number'
    AND (b->>'opacity')::numeric BETWEEN 0 AND 1,false)
  THEN RAISE EXCEPTION 'Opacidade inválida' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER plans_background_files BEFORE INSERT OR UPDATE OF geometry ON plans
  FOR EACH ROW EXECUTE FUNCTION check_plan_background_files();
