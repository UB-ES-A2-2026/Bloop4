-- 001 · Catàleg del Sprint 0: categories (arbre de dos nivells), venedors i productes.
-- És tot el que necessiten els dos casos d'ús: veure el catàleg i filtrar-lo per categoria.

-- Categories jeràrquiques (arbre via parent_id). sort_order fixa l'ordre del filtre.
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES categories (id) ON DELETE RESTRICT,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  -- El frontend fa servir l'slug de la categoria arrel per triar el color de les targetes.
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order  integer NOT NULL DEFAULT 0,
  CHECK (parent_id <> id)
);
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);

-- Venedor: només el que mostra la targeta de producte ("raó social · ciutat").
CREATE TABLE IF NOT EXISTS sellers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name  text NOT NULL CHECK (btrim(legal_name) <> ''),
  city        text NOT NULL CHECK (btrim(city) <> '')
);

CREATE TABLE IF NOT EXISTS products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,
  category_id  uuid NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  name         text NOT NULL CHECK (btrim(name) <> ''),
  -- Import exacte (mai float) i moneda ISO 4217.
  daily_price  numeric(12,2) NOT NULL CHECK (daily_price >= 0),
  currency     char(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_seller_id_idx ON products (seller_id);
