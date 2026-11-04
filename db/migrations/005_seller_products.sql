-- 005 · Publicació de productes per part del venedor (US-10).
-- Els productes passen a tenir estat (esborrany / publicat), pes i mides (per triar el vehicle
-- del lliurament, US-07) i unitats físiques (product_units) guardades als magatzems del venedor.
-- Els requisits per publicar (foto, preu, unitats, pes i mides) els comprova l'API.

-- Els productes que ja existeixen eren visibles al catàleg: queden publicats. Els nous, esborrany.
ALTER TABLE products ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published'));
ALTER TABLE products ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(8,2) CHECK (weight_kg > 0),
  ADD COLUMN IF NOT EXISTS length_cm  numeric(7,1) CHECK (length_cm > 0),
  ADD COLUMN IF NOT EXISTS width_cm   numeric(7,1) CHECK (width_cm > 0),
  ADD COLUMN IF NOT EXISTS height_cm  numeric(7,1) CHECK (height_cm > 0);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);

-- Clau alternativa per a les FK compostes: una unitat només pot ser d'un producte del mateix venedor.
ALTER TABLE products ADD CONSTRAINT products_id_seller_id_key UNIQUE (id, seller_id);

-- Només un venedor verificat per l'administrador pot publicar.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS warehouses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,
  name       text NOT NULL CHECK (btrim(name) <> ''),
  city       text NOT NULL CHECK (btrim(city) <> ''),
  UNIQUE (seller_id, name),
  UNIQUE (id, seller_id)
);

-- Inventari físic: una fila per unitat. La disponibilitat no es guarda aquí: es dedueix de
-- l'estat i de les reserves (US-05).
CREATE TABLE IF NOT EXISTS product_units (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL,
  seller_id     uuid NOT NULL,
  warehouse_id  uuid NOT NULL,
  status        text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'retired')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, seller_id)   REFERENCES products (id, seller_id)   ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id, seller_id) REFERENCES warehouses (id, seller_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS product_units_product_id_idx ON product_units (product_id);
CREATE INDEX IF NOT EXISTS product_units_warehouse_id_idx ON product_units (warehouse_id);
