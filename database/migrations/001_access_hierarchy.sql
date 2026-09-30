-- Sem seeds. Cada arquivo é aplicado integralmente em uma transação pelo migrador.
CREATE DOMAIN entity_name AS text COLLATE "C"
  CHECK (length(VALUE) BETWEEN 1 AND 200 AND VALUE !~ '^[[:space:]]*$');

CREATE FUNCTION geometry_position_valid(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  RETURN coalesce(jsonb_typeof(value) = 'object'
    AND jsonb_typeof(value->'x') = 'number' AND jsonb_typeof(value->'y') = 'number'
    AND abs((value->>'x')::double precision) < 'Infinity'::double precision
    AND abs((value->>'y')::double precision) < 'Infinity'::double precision, false);
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END $$;

CREATE FUNCTION geometry_rectangle_valid(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  RETURN coalesce(geometry_position_valid(value)
    AND jsonb_typeof(value->'width') = 'number' AND jsonb_typeof(value->'height') = 'number'
    AND jsonb_typeof(value->'rotation') = 'number'
    AND (value->>'width')::double precision > 0 AND (value->>'width')::double precision < 'Infinity'::double precision
    AND (value->>'height')::double precision > 0 AND (value->>'height')::double precision < 'Infinity'::double precision
    AND (value->>'rotation')::double precision >= 0 AND (value->>'rotation')::double precision < 360, false);
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END $$;

CREATE FUNCTION geometry_polygon_valid(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE vertex jsonb; following jsonb; area double precision := 0; i integer;
BEGIN
  IF jsonb_typeof(value) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(value) < 3 THEN RETURN false; END IF;
  FOR i IN 0..jsonb_array_length(value)-1 LOOP
    vertex := value->i; following := value->((i+1) % jsonb_array_length(value));
    IF NOT geometry_position_valid(vertex) OR NOT geometry_position_valid(following) THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(value) WITH ORDINALITY p(v, n)
      WHERE n < i+1 AND (v->>'x')::double precision = (vertex->>'x')::double precision
      AND (v->>'y')::double precision = (vertex->>'y')::double precision) THEN RETURN false; END IF;
    area := area + (vertex->>'x')::double precision * (following->>'y')::double precision
      - (following->>'x')::double precision * (vertex->>'y')::double precision;
  END LOOP;
  RETURN area <> 0 AND abs(area) < 'Infinity'::double precision;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END $$;

CREATE FUNCTION geometry_plan_valid(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE wall jsonb; opening jsonb; background jsonb; wall_ids text[] := '{}'; opening_ids text[] := '{}'; wall_length double precision;
BEGIN
  IF NOT coalesce(jsonb_typeof(value) = 'object' AND value->'version' = '1'::jsonb
    AND value->>'unit' = 'm' AND jsonb_typeof(value->'walls') = 'array'
    AND jsonb_typeof(value->'openings') = 'array', false) THEN RETURN false; END IF;
  FOR wall IN SELECT jsonb_array_elements(value->'walls') LOOP
    IF NOT coalesce(jsonb_typeof(wall->'id') = 'string' AND length(btrim(wall->>'id')) > 0
      AND NOT (wall->>'id' = ANY(wall_ids)) AND geometry_position_valid(wall->'start')
      AND geometry_position_valid(wall->'end') AND jsonb_typeof(wall->'thickness') = 'number'
      AND (wall->>'thickness')::double precision > 0
      AND (wall->>'thickness')::double precision < 'Infinity'::double precision
      AND ((wall->'start'->>'x')::double precision <> (wall->'end'->>'x')::double precision
        OR (wall->'start'->>'y')::double precision <> (wall->'end'->>'y')::double precision), false) THEN RETURN false; END IF;
    wall_ids := array_append(wall_ids, wall->>'id');
  END LOOP;
  FOR opening IN SELECT jsonb_array_elements(value->'openings') LOOP
    IF NOT coalesce(jsonb_typeof(opening->'id') = 'string' AND length(btrim(opening->>'id')) > 0
      AND NOT (opening->>'id' = ANY(opening_ids)) AND opening->>'kind' IN ('door', 'window')
      AND jsonb_typeof(opening->'wallId') = 'string' AND opening->>'wallId' = ANY(wall_ids)
      AND jsonb_typeof(opening->'offset') = 'number' AND (opening->>'offset')::double precision >= 0
      AND jsonb_typeof(opening->'width') = 'number' AND (opening->>'width')::double precision > 0, false) THEN RETURN false; END IF;
    SELECT v INTO wall FROM jsonb_array_elements(value->'walls') v WHERE v->>'id' = opening->>'wallId';
    wall_length := sqrt(power((wall->'end'->>'x')::double precision - (wall->'start'->>'x')::double precision, 2)
      + power((wall->'end'->>'y')::double precision - (wall->'start'->>'y')::double precision, 2));
    IF (opening->>'offset')::double precision + (opening->>'width')::double precision > wall_length THEN RETURN false; END IF;
    opening_ids := array_append(opening_ids, opening->>'id');
  END LOOP;
  IF value ? 'background' THEN
    background := value->'background';
    IF NOT coalesce(jsonb_typeof(background->'originalFileId') = 'string' AND length(btrim(background->>'originalFileId')) > 0
      AND jsonb_typeof(background->'renderedFileId') = 'string' AND length(btrim(background->>'renderedFileId')) > 0
      AND (background->'page' = 'null'::jsonb OR (jsonb_typeof(background->'page') = 'number'
        AND (background->>'page')::numeric > 0 AND mod((background->>'page')::numeric, 1) = 0))
      AND jsonb_typeof(background->'sourceWidthPx') = 'number' AND (background->>'sourceWidthPx')::numeric > 0
      AND mod((background->>'sourceWidthPx')::numeric, 1) = 0
      AND jsonb_typeof(background->'sourceHeightPx') = 'number' AND (background->>'sourceHeightPx')::numeric > 0
      AND mod((background->>'sourceHeightPx')::numeric, 1) = 0
      AND geometry_rectangle_valid(background->'placement'), false) THEN RETURN false; END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END $$;

CREATE FUNCTION touch_entity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Identificador imutável' USING ERRCODE = '23514'; END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), login text COLLATE "C" NOT NULL,
  name entity_name NOT NULL, password_hash text NOT NULL CHECK (length(password_hash) > 0),
  is_admin boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(login) BETWEEN 1 AND 200 AND login !~ '^[[:space:]]*$')
);
CREATE UNIQUE INDEX users_login_unique ON users (lower(login));
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text COLLATE "C" NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, CHECK (expires_at > created_at), CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name entity_name NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('manager', 'viewer')), UNIQUE(user_id, company_id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_permissions_company_idx ON company_permissions(company_id);
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name entity_name NOT NULL, classification entity_name NOT NULL DEFAULT 'Outra',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, id), UNIQUE(company_id, name)
);
CREATE TABLE floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, unit_id uuid NOT NULL, name entity_name NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, unit_id) REFERENCES units(company_id, id) ON DELETE RESTRICT,
  UNIQUE(company_id, id), UNIQUE(company_id, unit_id, id), UNIQUE(unit_id, name)
);
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, unit_id uuid NOT NULL, floor_id uuid NOT NULL,
  name entity_name NOT NULL, revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  geometry jsonb NOT NULL DEFAULT '{"version":1,"unit":"m","walls":[],"openings":[]}' CHECK (geometry_plan_valid(geometry)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, unit_id, floor_id) REFERENCES floors(company_id, unit_id, id) ON DELETE RESTRICT,
  UNIQUE(company_id, id), UNIQUE(company_id, unit_id, id), UNIQUE(floor_id, name)
);
CREATE INDEX floors_unit_idx ON floors(company_id, unit_id);
CREATE INDEX plans_floor_idx ON plans(company_id, unit_id, floor_id);
CREATE TABLE sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, plan_id uuid NOT NULL, name entity_name NOT NULL,
  polygon jsonb NOT NULL CHECK (geometry_polygon_valid(polygon)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, plan_id) REFERENCES plans(company_id, id) ON DELETE RESTRICT,
  UNIQUE(company_id, plan_id, id), UNIQUE(plan_id, name)
);
CREATE TABLE desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, plan_id uuid NOT NULL, sector_id uuid,
  name entity_name NOT NULL,
  placement jsonb NOT NULL DEFAULT '{"x":0,"y":0,"width":1.2,"height":0.6,"rotation":0}' CHECK (geometry_rectangle_valid(placement)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, plan_id) REFERENCES plans(company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id, plan_id, sector_id) REFERENCES sectors(company_id, plan_id, id) ON DELETE RESTRICT,
  UNIQUE(company_id, id), UNIQUE(plan_id, name)
);
CREATE INDEX sectors_plan_idx ON sectors(company_id, plan_id);
CREATE INDEX desks_plan_idx ON desks(company_id, plan_id);
CREATE INDEX desks_sector_idx ON desks(company_id, plan_id, sector_id);
CREATE TABLE points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, desk_id uuid NOT NULL,
  name entity_name NOT NULL, ordinal integer NOT NULL CHECK (ordinal > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, desk_id) REFERENCES desks(company_id, id) ON DELETE RESTRICT,
  UNIQUE(company_id, id), UNIQUE(desk_id, name), UNIQUE(desk_id, ordinal)
);
CREATE TABLE datacenters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, unit_id uuid NOT NULL, plan_id uuid,
  name entity_name NOT NULL, placement jsonb CHECK (placement IS NULL OR geometry_rectangle_valid(placement)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id, unit_id) REFERENCES units(company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id, unit_id, plan_id) REFERENCES plans(company_id, unit_id, id) ON DELETE RESTRICT,
  CHECK (placement IS NULL OR plan_id IS NOT NULL),
  UNIQUE(company_id, unit_id, id), UNIQUE(unit_id, name)
);
CREATE INDEX points_desk_idx ON points(company_id, desk_id);
CREATE INDEX datacenters_unit_idx ON datacenters(company_id, unit_id);
CREATE INDEX datacenters_plan_idx ON datacenters(company_id, unit_id, plan_id);

DO $$ DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','companies','company_permissions','units','floors','plans','sectors','desks','points','datacenters'] LOOP
    EXECUTE format('CREATE TRIGGER touch_entity BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_entity()', table_name);
  END LOOP;
END $$;
