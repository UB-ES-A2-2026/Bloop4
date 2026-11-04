-- 007 · Cistella de reserva (US-06).
-- La cistella és l'esdeveniment del client en estat 'draft' (com a molt un per client). Cada
-- línia guarda una còpia (snapshot) del preu per dia, la fiança, la moneda i les condicions de
-- l'assegurança del moment en què s'hi va afegir, perquè els canvis del catàleg no la modifiquin.

ALTER TABLE event_items
  ADD COLUMN IF NOT EXISTS daily_price    numeric(12,2) CHECK (daily_price >= 0),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) CHECK (deposit_amount >= 0),
  ADD COLUMN IF NOT EXISTS currency       char(3) CHECK (currency ~ '^[A-Z]{3}$'),
  ADD COLUMN IF NOT EXISTS insurance      text,
  ADD COLUMN IF NOT EXISTS added_at       timestamptz NOT NULL DEFAULT now();

-- Les línies que ja existien prenen el preu actual del producte.
UPDATE event_items ei
SET daily_price = p.daily_price, deposit_amount = p.deposit_amount, currency = p.currency, insurance = p.insurance
FROM products p
WHERE p.id = ei.product_id AND ei.daily_price IS NULL;

ALTER TABLE event_items
  ALTER COLUMN daily_price SET NOT NULL,
  ALTER COLUMN deposit_amount SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL;

-- Si una línia s'insereix sense snapshot, el pren del producte en aquell moment.
CREATE OR REPLACE FUNCTION event_items_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.daily_price IS NULL OR NEW.deposit_amount IS NULL OR NEW.currency IS NULL THEN
    SELECT coalesce(NEW.daily_price, p.daily_price), coalesce(NEW.deposit_amount, p.deposit_amount),
           coalesce(NEW.currency, p.currency), coalesce(NEW.insurance, p.insurance)
    INTO NEW.daily_price, NEW.deposit_amount, NEW.currency, NEW.insurance
    FROM products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER event_items_snapshot BEFORE INSERT ON event_items
  FOR EACH ROW EXECUTE FUNCTION event_items_snapshot();

-- Última activitat de la cistella: passats 7 dies sense canvis, caduca.
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Com a molt una cistella oberta per client.
CREATE UNIQUE INDEX IF NOT EXISTS events_one_draft_per_customer ON events (customer_id) WHERE status = 'draft';
