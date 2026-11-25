-- 016 · Ubicació del rider durant un lliurament (US-16).
-- Decisió del Sprint 2 (RGPD): només es guarda l'última posició de cada lliurament en curs, sense
-- historial de rutes, i s'esborra quan el lliurament deixa d'estar en curs.

CREATE TABLE IF NOT EXISTS rider_locations (
  delivery_id  uuid PRIMARY KEY REFERENCES deliveries (id) ON DELETE CASCADE,
  rider_id     uuid NOT NULL REFERENCES riders (user_id) ON DELETE RESTRICT,
  latitude     numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude    numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Precisió que dona el navegador, en metres.
  accuracy_m   numeric(8,1) CHECK (accuracy_m >= 0),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- Només el rider assignat pot tenir posició d'un lliurament, i només mentre és en curs.
CREATE OR REPLACE FUNCTION rider_locations_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = NEW.delivery_id AND d.rider_id = NEW.rider_id AND d.status = 'in_transit' AND d.delivery_type = 'delivery'
  ) THEN
    RAISE EXCEPTION 'El lliurament % no és en curs amb el rider %', NEW.delivery_id, NEW.rider_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER rider_locations_check BEFORE INSERT OR UPDATE ON rider_locations
  FOR EACH ROW EXECUTE FUNCTION rider_locations_check();

-- Quan el lliurament acaba (o passa a qualsevol altre estat), la posició s'esborra.
CREATE OR REPLACE FUNCTION deliveries_forget_location() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rider_locations WHERE delivery_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER deliveries_forget_location AFTER UPDATE OF status ON deliveries
  FOR EACH ROW WHEN (NEW.status <> 'in_transit') EXECUTE FUNCTION deliveries_forget_location();
