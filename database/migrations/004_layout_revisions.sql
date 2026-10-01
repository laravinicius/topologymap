-- Revisão da planta também protege alterações aos objetos posicionáveis e aos setores.
ALTER TABLE plans ADD COLUMN camera jsonb NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb
  CHECK (jsonb_typeof(camera) = 'object' AND jsonb_typeof(camera->'x') = 'number'
    AND jsonb_typeof(camera->'y') = 'number' AND jsonb_typeof(camera->'zoom') = 'number'
    AND abs((camera->>'x')::double precision) < 'Infinity'::double precision
    AND abs((camera->>'y')::double precision) < 'Infinity'::double precision
    AND (camera->>'zoom')::double precision > 0 AND (camera->>'zoom')::double precision < 'Infinity'::double precision);

CREATE FUNCTION bump_plan_layout_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_plan uuid; new_plan uuid;
BEGIN
  IF current_setting('topologia.layout_save', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN old_plan := OLD.plan_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_plan := NEW.plan_id; END IF;
  IF TG_TABLE_NAME = 'sectors' THEN
    IF TG_OP = 'UPDATE' AND OLD.plan_id = NEW.plan_id AND OLD.polygon IS NOT DISTINCT FROM NEW.polygon THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'desks' THEN
    IF TG_OP = 'UPDATE' AND OLD.plan_id = NEW.plan_id AND OLD.sector_id IS NOT DISTINCT FROM NEW.sector_id
      AND OLD.placement IS NOT DISTINCT FROM NEW.placement THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'racks' THEN
    IF TG_OP = 'UPDATE' AND OLD.plan_id IS NOT DISTINCT FROM NEW.plan_id AND OLD.placement IS NOT DISTINCT FROM NEW.placement THEN RETURN NEW; END IF;
  END IF;
  IF old_plan IS NOT NULL THEN UPDATE plans SET revision=revision+1 WHERE id=old_plan; END IF;
  IF new_plan IS NOT NULL AND new_plan IS DISTINCT FROM old_plan THEN UPDATE plans SET revision=revision+1 WHERE id=new_plan; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER sector_layout_revision AFTER INSERT OR UPDATE OR DELETE ON sectors FOR EACH ROW EXECUTE FUNCTION bump_plan_layout_revision();
CREATE TRIGGER desk_layout_revision AFTER INSERT OR UPDATE OR DELETE ON desks FOR EACH ROW EXECUTE FUNCTION bump_plan_layout_revision();
CREATE TRIGGER rack_layout_revision AFTER INSERT OR UPDATE OR DELETE ON racks FOR EACH ROW EXECUTE FUNCTION bump_plan_layout_revision();
