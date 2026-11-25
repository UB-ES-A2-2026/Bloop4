-- 015 · Prova de lliurament i recollida amb fotos i checklist (US-11).
-- El rider puja fotos de cada línia de producte del servei i, en acabar, registra l'estat de
-- cada línia. Els desperfectes, el material que falta o un client absent són incidències, que
-- retenen la fiança fins que un administrador les resol. Les fotos no són públiques: es desen fora
-- de /uploads/ i les serveix l'API comprovant qui les demana.

CREATE TABLE IF NOT EXISTS proof_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id    uuid NOT NULL REFERENCES deliveries (id) ON DELETE RESTRICT,
  -- Línia de producte fotografiada (NULL = foto d'una incidència, no d'una línia).
  event_item_id  uuid REFERENCES event_items (id) ON DELETE RESTRICT,
  -- Ruta relativa dins del directori privat de proves (la genera el servidor).
  path           text NOT NULL UNIQUE CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  content_type   text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proof_photos_delivery_idx ON proof_photos (delivery_id, event_item_id);

-- Una línia fotografiada ha de ser del mateix esdeveniment i del mateix venedor que el servei.
CREATE OR REPLACE FUNCTION proof_photos_check_item() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM deliveries d
    JOIN event_items ei ON ei.event_id = d.event_id
    JOIN products p     ON p.id = ei.product_id AND p.seller_id = d.seller_id
    WHERE d.id = NEW.delivery_id AND ei.id = NEW.event_item_id
  ) THEN
    RAISE EXCEPTION 'La línia % no és del servei %', NEW.event_item_id, NEW.delivery_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER proof_photos_check_item BEFORE INSERT OR UPDATE ON proof_photos
  FOR EACH ROW EXECUTE FUNCTION proof_photos_check_item();

-- Prova d'un servei completat: una per servei.
CREATE TABLE IF NOT EXISTS delivery_proofs (
  delivery_id   uuid PRIMARY KEY REFERENCES deliveries (id) ON DELETE RESTRICT,
  rider_id      uuid NOT NULL REFERENCES riders (user_id) ON DELETE RESTRICT,
  completed_at  timestamptz NOT NULL DEFAULT now()
);

-- Checklist: l'estat de cada línia del servei en el moment del lliurament o de la recollida.
CREATE TABLE IF NOT EXISTS proof_items (
  delivery_id    uuid NOT NULL REFERENCES delivery_proofs (delivery_id) ON DELETE RESTRICT,
  event_item_id  uuid NOT NULL REFERENCES event_items (id) ON DELETE RESTRICT,
  condition      text NOT NULL CHECK (condition IN ('correct', 'damaged', 'incomplete')),
  note           text CHECK (btrim(note) <> '' AND char_length(note) <= 1000),
  PRIMARY KEY (delivery_id, event_item_id),
  -- Si el material no és correcte, cal explicar què passa.
  CHECK (condition = 'correct' OR note IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS incidents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id      uuid NOT NULL REFERENCES deliveries (id) ON DELETE RESTRICT,
  kind             text NOT NULL CHECK (kind IN ('damaged', 'missing', 'customer_absent', 'other')),
  description      text NOT NULL CHECK (btrim(description) <> '' AND char_length(description) <= 2000),
  photo_id         uuid REFERENCES proof_photos (id) ON DELETE RESTRICT,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES users (id) ON DELETE RESTRICT,
  resolution_note  text CHECK (btrim(resolution_note) <> '' AND char_length(resolution_note) <= 1000),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS incidents_delivery_idx ON incidents (delivery_id);
CREATE INDEX IF NOT EXISTS incidents_open_idx ON incidents (created_at) WHERE status = 'open';
