-- 017 · Valoracions i comentaris verificats de productes (US-04).
-- Només pot valorar un producte el client d'una reserva finalitzada (material recollit) que el
-- contenia: una valoració per client, producte i reserva. L'administrador pot ocultar-ne; les
-- ocultes no es mostren ni compten a la mitjana.

CREATE TABLE IF NOT EXISTS reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  event_id     uuid NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  customer_id  uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text CHECK (btrim(comment) <> '' AND char_length(comment) <= 1000),
  hidden       boolean NOT NULL DEFAULT false,
  hidden_at    timestamptz,
  hidden_by    uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id, event_id),
  CHECK (hidden = (hidden_at IS NOT NULL AND hidden_by IS NOT NULL))
);
-- Valoracions visibles d'un producte, de la més recent a la més antiga.
CREATE INDEX IF NOT EXISTS reviews_product_visible_idx ON reviews (product_id, created_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS reviews_event_id_idx ON reviews (event_id);

-- La reserva ha de ser del client, contenir el producte i estar finalitzada.
CREATE OR REPLACE FUNCTION reviews_check_booking() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events e JOIN event_items ei ON ei.event_id = e.id
    WHERE e.id = NEW.event_id AND e.customer_id = NEW.customer_id AND ei.product_id = NEW.product_id
      AND e.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'La reserva % no permet valorar el producte %', NEW.event_id, NEW.product_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reviews_check_booking BEFORE INSERT OR UPDATE OF product_id, event_id, customer_id ON reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_check_booking();
