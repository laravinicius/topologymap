-- Aditiva: mesas existentes continuam privadas; não altera cadastros/layout/conexões.
CREATE TABLE desk_public_links (
  desk_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{64}$'),
  enabled boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0 AND revision <= 9007199254740991),
  FOREIGN KEY (company_id, desk_id) REFERENCES desks(company_id, id) ON DELETE CASCADE
);
