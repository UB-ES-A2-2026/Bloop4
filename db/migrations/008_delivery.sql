-- 008 · Adreça i franges de lliurament i recollida (US-07).
-- Cobertura per codis postals de cada venedor (sense PostGIS ni geocodificació externa).
-- Cada venedor de la comanda fa un lliurament abans de l'esdeveniment i una recollida després,
-- en franges de 2 h. El vehicle (i el preu del transport) depèn del pes i del volum del que porta.

-- Codis postals on reparteix cada venedor.
CREATE TABLE IF NOT EXISTS seller_postal_codes (
  seller_id    uuid NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,
  postal_code  text NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  PRIMARY KEY (seller_id, postal_code)
);
CREATE INDEX IF NOT EXISTS seller_postal_codes_postal_code_idx ON seller_postal_codes (postal_code);

-- Quants lliuraments o recollides pot fer cada venedor en una mateixa franja de 2 h.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS delivery_capacity integer NOT NULL DEFAULT 3 CHECK (delivery_capacity > 0);

-- Vehicles i preu del servei (lliurament + recollida). Els límits i els preus són dades de
-- negoci: el Product Owner els pot canviar sense tocar el codi. NULL = sense límit.
CREATE TABLE IF NOT EXISTS vehicle_types (
  code            text PRIMARY KEY CHECK (code IN ('cargo_bike', 'car', 'van', 'truck')),
  name            text NOT NULL CHECK (btrim(name) <> ''),
  max_weight_kg   numeric(8,2) CHECK (max_weight_kg > 0),
  max_volume_m3   numeric(8,3) CHECK (max_volume_m3 > 0),
  price           numeric(12,2) NOT NULL CHECK (price >= 0),
  currency        char(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$')
);
INSERT INTO vehicle_types (code, name, max_weight_kg, max_volume_m3, price) VALUES
  ('cargo_bike', 'Bicicleta de carga',   40,  0.15, 15.00),
  ('car',        'Coche',               150,  0.80, 25.00),
  ('van',        'Furgoneta',          1000,  8.00, 45.00),
  ('truck',      'Camión',             NULL,  NULL, 90.00)
ON CONFLICT (code) DO NOTHING;

-- Adreça de l'esdeveniment. És una dada personal: només la veuen el client i, més endavant,
-- els venedors i els riders de la comanda.
CREATE TABLE IF NOT EXISTS addresses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  street               text NOT NULL CHECK (btrim(street) <> ''),
  postal_code          text NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  city                 text NOT NULL CHECK (btrim(city) <> ''),
  access_instructions  text CHECK (btrim(access_instructions) <> ''),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);

ALTER TABLE events ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES addresses (id) ON DELETE RESTRICT;

-- Un lliurament i una recollida per venedor i esdeveniment.
CREATE TABLE IF NOT EXISTS deliveries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  seller_id      uuid NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,
  delivery_type  text NOT NULL CHECK (delivery_type IN ('delivery', 'pickup')),
  time_window    tstzrange NOT NULL CHECK (NOT isempty(time_window) AND lower_inc(time_window) AND NOT upper_inc(time_window)),
  vehicle_type   text NOT NULL REFERENCES vehicle_types (code) ON DELETE RESTRICT,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'incident', 'cancelled')),
  UNIQUE (event_id, seller_id, delivery_type)
);
CREATE INDEX IF NOT EXISTS deliveries_seller_window_idx ON deliveries USING gist (seller_id, time_window);
-- El preu del transport es guarda a la línia del venedor de la comanda: un servei (lliurament +
-- recollida) per venedor. Es congela igual que els preus dels productes.
CREATE TABLE IF NOT EXISTS event_transport (
  event_id      uuid NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  seller_id     uuid NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,
  vehicle_type  text NOT NULL REFERENCES vehicle_types (code) ON DELETE RESTRICT,
  price         numeric(12,2) NOT NULL CHECK (price >= 0),
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  PRIMARY KEY (event_id, seller_id)
);
