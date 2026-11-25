-- 014 · Seguiment de l'estat de la comanda (US-09).
-- Historial de cada canvi d'estat d'un servei (l'escriu un trigger: cap canvi se'n pot escapar).
-- Les transicions permeses es validen a l'API. La taula d'avisos dins de l'aplicació és a la 009.

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Si es torna a desar el lliurament d'una cistella (US-07), els serveis vells s'esborren amb el seu historial.
  delivery_id  uuid NOT NULL REFERENCES deliveries (id) ON DELETE CASCADE,
  status       text NOT NULL
               CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'incident', 'cancelled')),
  changed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_status_history_delivery_idx ON delivery_status_history (delivery_id, changed_at);

CREATE OR REPLACE FUNCTION deliveries_log_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO delivery_status_history (delivery_id, status) VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER deliveries_log_status AFTER INSERT OR UPDATE OF status ON deliveries
  FOR EACH ROW EXECUTE FUNCTION deliveries_log_status();

-- Els serveis que ja existien comencen l'historial amb el seu estat actual.
INSERT INTO delivery_status_history (delivery_id, status, changed_at)
SELECT d.id, d.status, d.changed_at FROM deliveries d
WHERE NOT EXISTS (SELECT 1 FROM delivery_status_history h WHERE h.delivery_id = d.id);
