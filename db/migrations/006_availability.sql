-- 006 · Disponibilitat per rang de dates (US-05).
-- Una reserva bloqueja unitats físiques concretes durant un interval semiobert [inici, fi).
-- Es crea la part mínima d'esdeveniments (la comanda del client) i línies perquè les unitats
-- reservades hi puguin penjar; US-06 hi afegeix la cistella i US-12 l'EXCLUDE contra les
-- dobles reserves.

-- btree_gist permet indexar (i, a US-12, restringir) uuid i rangs alhora amb GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Marge de preparació entre lloguers de cada venedor (abans i després de cada reserva).
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS prep_margin interval NOT NULL DEFAULT interval '2 hours'
  CHECK (prep_margin >= interval '0' AND prep_margin <= interval '72 hours');

-- Esdeveniment = comanda del client. 'draft' és la cistella (US-06).
CREATE TABLE IF NOT EXISTS events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'cancelled', 'completed')),
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS events_customer_id_idx ON events (customer_id);

CREATE TABLE IF NOT EXISTS event_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity    integer NOT NULL CHECK (quantity > 0),
  UNIQUE (event_id, product_id)
);
CREATE INDEX IF NOT EXISTS event_items_product_id_idx ON event_items (product_id);

-- Unitat concreta assignada a una línia durant tot l'interval logístic (lliurament → recollida).
CREATE TABLE IF NOT EXISTS event_item_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_item_id    uuid NOT NULL REFERENCES event_items (id) ON DELETE RESTRICT,
  unit_id          uuid NOT NULL REFERENCES product_units (id) ON DELETE RESTRICT,
  reserved_period  tstzrange NOT NULL
                   CHECK (NOT isempty(reserved_period) AND lower_inc(reserved_period) AND NOT upper_inc(reserved_period)
                          AND NOT lower_inf(reserved_period) AND NOT upper_inf(reserved_period)),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_item_units_event_item_id_idx ON event_item_units (event_item_id);
-- Consulta de disponibilitat: reserves actives d'una unitat que se solapen (&&) amb un interval.
CREATE INDEX IF NOT EXISTS event_item_units_active_period_idx
  ON event_item_units USING gist (unit_id, reserved_period) WHERE is_active;
