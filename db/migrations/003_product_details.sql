-- 003 · Fitxa de producte (US-03): descripció, fiança, assegurança, especificacions i imatges.
-- Els productes que ja existeixen queden sense descripció, amb fiança 0, sense assegurança,
-- sense especificacions i sense imatges: la fitxa ho mostra com a «Sin fianza» / «Sin seguro».

ALTER TABLE products
  -- NULL = sense descripció; si n'hi ha, no pot ser buida.
  ADD COLUMN IF NOT EXISTS description    text CHECK (btrim(description) <> ''),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  -- Condicions de l'assegurança en text. NULL = el producte no té assegurança.
  ADD COLUMN IF NOT EXISTS insurance      text CHECK (btrim(insurance) <> ''),
  -- Especificacions tècniques: { "Potencia": "1300 W", "Peso": "18 kg", ... }.
  ADD COLUMN IF NOT EXISTS specs          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(specs) = 'object');

-- Imatges del producte. La BD només en guarda la ruta pública; el fitxer el serveix Nginx.
CREATE TABLE IF NOT EXISTS product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  path        text NOT NULL CHECK (path ~ '^/[A-Za-z0-9/_.-]+$'),
  alt_text    text NOT NULL CHECK (btrim(alt_text) <> ''),
  sort_order  integer NOT NULL DEFAULT 0,
  -- Una sola imatge per posició dins d'un producte (també serveix d'índex per product_id).
  UNIQUE (product_id, sort_order)
);
