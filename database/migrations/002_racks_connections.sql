CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE racks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, unit_id uuid NOT NULL, datacenter_id uuid NOT NULL,
  plan_id uuid, name entity_name NOT NULL, capacity_u integer NOT NULL CHECK (capacity_u > 0),
  placement jsonb CHECK (placement IS NULL OR geometry_rectangle_valid(placement)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, unit_id, datacenter_id) REFERENCES datacenters(company_id, unit_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id, unit_id, plan_id) REFERENCES plans(company_id, unit_id, id) ON DELETE RESTRICT,
  CHECK (placement IS NULL OR plan_id IS NOT NULL),
  UNIQUE(company_id, id, capacity_u), UNIQUE(datacenter_id, name)
);
CREATE INDEX racks_plan_idx ON racks(company_id, unit_id, plan_id);
CREATE INDEX racks_datacenter_idx ON racks(company_id, unit_id, datacenter_id);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, rack_id uuid NOT NULL,
  name entity_name NOT NULL, kind text NOT NULL CHECK (kind IN ('generic', 'patch_panel')),
  equipment_type entity_name NOT NULL,
  start_u integer NOT NULL CHECK (start_u > 0), height_u integer NOT NULL CHECK (height_u > 0),
  -- Testemunho da capacidade: obter por INSERT ... SELECT do rack, não da entrada do usuário.
  -- A FK CASCADE revalida TODOS os equipamentos quando a capacidade muda.
  -- FK + CHECK protegem a corrida entre redução do rack e INSERT/UPDATE do equipamento.
  rack_capacity_u integer NOT NULL,
  occupied_u int8range GENERATED ALWAYS AS (int8range(start_u::bigint, start_u::bigint + height_u::bigint, '[)')) STORED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_capacity_check CHECK (start_u::bigint + height_u::bigint - 1 <= rack_capacity_u),
  CONSTRAINT equipment_rack_fk FOREIGN KEY(company_id, rack_id, rack_capacity_u)
    REFERENCES racks(company_id, id, capacity_u) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT equipment_no_overlap EXCLUDE USING gist (rack_id WITH =, occupied_u WITH &&),
  UNIQUE(company_id, id, kind), UNIQUE(rack_id, name)
);
CREATE INDEX equipment_rack_idx ON equipment(company_id, rack_id, rack_capacity_u);

CREATE TABLE ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, equipment_id uuid NOT NULL,
  equipment_kind text NOT NULL DEFAULT 'patch_panel' CHECK (equipment_kind = 'patch_panel'),
  name entity_name NOT NULL, ordinal integer NOT NULL CHECK (ordinal > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, equipment_id, equipment_kind) REFERENCES equipment(company_id, id, kind) ON DELETE RESTRICT,
  UNIQUE(company_id, id), UNIQUE(equipment_id, name), UNIQUE(equipment_id, ordinal)
);
CREATE INDEX ports_equipment_idx ON ports(company_id, equipment_id, equipment_kind);

CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  point_id uuid NOT NULL UNIQUE, port_id uuid NOT NULL UNIQUE,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, point_id) REFERENCES points(company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id, port_id) REFERENCES ports(company_id, id) ON DELETE RESTRICT
);
CREATE INDEX connections_company_idx ON connections(company_id);

CREATE FUNCTION increment_connection_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END $$;
CREATE TRIGGER connection_revision BEFORE UPDATE ON connections FOR EACH ROW EXECUTE FUNCTION increment_connection_revision();
DO $$ DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['racks','equipment','ports','connections'] LOOP
    EXECUTE format('CREATE TRIGGER touch_entity BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_entity()', table_name);
  END LOOP;
END $$;
