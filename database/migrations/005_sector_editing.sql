-- Edição atômica permite permutar nomes sem colisões transitórias. Sem apagar dados.
ALTER TABLE sectors DROP CONSTRAINT sectors_plan_id_name_key;
ALTER TABLE sectors ADD CONSTRAINT sectors_plan_id_name_key UNIQUE(plan_id,name) DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION bump_plan_layout_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_plan uuid; new_plan uuid;
BEGIN
  IF current_setting('topologia.layout_save', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN old_plan := OLD.plan_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_plan := NEW.plan_id; END IF;
  IF TG_TABLE_NAME = 'sectors' THEN
    IF TG_OP = 'UPDATE' AND OLD.plan_id = NEW.plan_id AND OLD.polygon IS NOT DISTINCT FROM NEW.polygon AND OLD.name IS NOT DISTINCT FROM NEW.name THEN RETURN NEW; END IF;
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
