-- 009 · Confirmació de la reserva amb bloqueig temporal d'estoc (US-12).
-- En confirmar la cistella, l'esdeveniment passa a 'pending_payment' i se li assignen unitats
-- físiques durant 15 minuts (hold_expires_at). La base de dades impedeix la doble reserva: dues
-- reserves actives de la mateixa unitat no es poden solapar (SQLSTATE 23P01).

-- Substitueix l'índex GiST de la 006: la restricció en crea un d'igual.
DROP INDEX IF EXISTS event_item_units_active_period_idx;
ALTER TABLE event_item_units
  ADD CONSTRAINT event_item_units_no_overlap
  EXCLUDE USING gist (unit_id WITH =, reserved_period WITH &&) WHERE (is_active);

CREATE SEQUENCE IF NOT EXISTS booking_number_seq;

ALTER TABLE events
  -- Fins quan es guarden les unitats mentre el client paga.
  ADD COLUMN IF NOT EXISTS hold_expires_at  timestamptz,
  -- Quan va caducar l'últim bloqueig sense pagament (per avisar el client a la cistella).
  ADD COLUMN IF NOT EXISTS hold_expired_at  timestamptz,
  ADD COLUMN IF NOT EXISTS booking_number   text UNIQUE CHECK (booking_number ~ '^B4-[0-9]{4}-[0-9]{6,}$'),
  -- Capçalera Idempotency-Key del checkout: repetir la petició no crea una altra reserva.
  ADD COLUMN IF NOT EXISTS checkout_key     text CHECK (char_length(checkout_key) BETWEEN 8 AND 128),
  ADD COLUMN IF NOT EXISTS confirmed_at     timestamptz;

ALTER TABLE events
  ADD CONSTRAINT events_pending_has_hold CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL),
  ADD CONSTRAINT events_checkout_key_key UNIQUE (customer_id, checkout_key);

-- Bloquejos que caduquen: els busca l'API cada minut i abans de cada checkout.
CREATE INDEX IF NOT EXISTS events_hold_expires_at_idx ON events (hold_expires_at) WHERE status = 'pending_payment';

-- El número de reserva (B4-2026-000042) s'assigna sol quan la cistella deixa de ser un esborrany.
CREATE OR REPLACE FUNCTION events_booking_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_number IS NULL AND NEW.status IN ('pending_payment', 'confirmed', 'completed') THEN
    NEW.booking_number := 'B4-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('booking_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER events_booking_number BEFORE INSERT OR UPDATE OF status ON events
  FOR EACH ROW EXECUTE FUNCTION events_booking_number();

-- Les reserves que ja existien també reben número.
UPDATE events SET status = status WHERE status IN ('pending_payment', 'confirmed', 'completed') AND booking_number IS NULL;
