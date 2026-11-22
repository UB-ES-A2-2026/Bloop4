-- 010 · Confirmació de la reserva amb bloqueig temporal d'estoc (US-12).
-- En confirmar la cistella, l'esdeveniment passa a 'pending_payment' i se li assignen unitats
-- físiques durant 15 minuts (hold_expires_at, de la 009). La base de dades impedeix la doble
-- reserva: dues reserves actives de la mateixa unitat no es poden solapar (SQLSTATE 23P01).

-- Substitueix l'índex GiST de la 006: la restricció en crea un d'igual.
DROP INDEX IF EXISTS event_item_units_active_period_idx;
ALTER TABLE event_item_units
  ADD CONSTRAINT event_item_units_no_overlap
  EXCLUDE USING gist (unit_id WITH =, reserved_period WITH &&) WHERE (is_active);

ALTER TABLE events
  -- Quan va caducar l'últim bloqueig sense pagament (per avisar el client a la cistella).
  ADD COLUMN IF NOT EXISTS hold_expired_at  timestamptz,
  -- Capçalera Idempotency-Key del checkout: repetir la petició no crea una altra reserva.
  ADD COLUMN IF NOT EXISTS checkout_key     text CHECK (char_length(checkout_key) BETWEEN 8 AND 128);

ALTER TABLE events
  ADD CONSTRAINT events_checkout_key_key UNIQUE (customer_id, checkout_key);

-- Bloquejos que caduquen: els busca l'API cada minut i abans de cada checkout.
CREATE INDEX IF NOT EXISTS events_hold_expires_at_idx ON events (hold_expires_at) WHERE status = 'pending_payment';
