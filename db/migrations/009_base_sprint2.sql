-- 009 · Esquema comú del Sprint 2.
-- El que fan servir diverses històries alhora, perquè cadascuna pugui arribar a `dev` en qualsevol
-- ordre: el número i l'estat de les reserves, els riders i l'assignació dels serveis, i els avisos
-- dins de l'aplicació. Les migracions de cada història (010–017) només depenen d'aquesta i del Sprint 1.

-- Reserves ------------------------------------------------------------------
-- Una reserva és un esdeveniment que ja no és la cistella: 'pending_payment' (unitats bloquejades
-- fins a hold_expires_at mentre el client paga, US-12), 'confirmed' (pagada, US-08) i 'completed'.
CREATE SEQUENCE IF NOT EXISTS booking_number_seq;

ALTER TABLE events
  -- Fins quan es guarden les unitats mentre el client paga.
  ADD COLUMN IF NOT EXISTS hold_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS booking_number   text UNIQUE CHECK (booking_number ~ '^B4-[0-9]{4}-[0-9]{6,}$'),
  ADD COLUMN IF NOT EXISTS confirmed_at     timestamptz;

ALTER TABLE events
  ADD CONSTRAINT events_pending_has_hold CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL);

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

-- Riders i serveis ----------------------------------------------------------
-- Un rider és un usuari amb el rol 'rider' (l'assigna un administrador) i un vehicle. Els serveis
-- són les files de `deliveries`: 'pending' = sense rider; quan un rider l'accepta (US-14) passa a
-- 'assigned', i després a 'in_transit' i 'delivered' (US-09, US-11).
CREATE TABLE IF NOT EXISTS riders (
  user_id       uuid PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  vehicle_type  text NOT NULL REFERENCES vehicle_types (code) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS rider_id     uuid REFERENCES riders (user_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS assigned_at  timestamptz,
  -- Últim canvi de la franja, de l'estat o del vehicle: si és posterior a `assigned_at`, el rider
  -- veu que el servei s'ha modificat després d'acceptar-lo.
  ADD COLUMN IF NOT EXISTS changed_at   timestamptz NOT NULL DEFAULT now();

ALTER TABLE deliveries
  -- Un servei pendent no té rider; un d'assignat, en curs o lliurat, sí.
  ADD CONSTRAINT deliveries_pending_without_rider CHECK (status <> 'pending' OR rider_id IS NULL),
  ADD CONSTRAINT deliveries_assigned_with_rider
    CHECK (status NOT IN ('assigned', 'in_transit', 'delivered') OR (rider_id IS NOT NULL AND assigned_at IS NOT NULL));

-- El rol 'rider' ha d'existir per poder tenir perfil de rider.
CREATE OR REPLACE FUNCTION riders_require_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.user_id AND role = 'rider') THEN
    RAISE EXCEPTION 'L''usuari % no té el rol rider', NEW.user_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER riders_require_role BEFORE INSERT OR UPDATE ON riders
  FOR EACH ROW EXECUTE FUNCTION riders_require_role();

CREATE OR REPLACE FUNCTION deliveries_touch_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.time_window IS DISTINCT FROM OLD.time_window OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type THEN
    NEW.changed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER deliveries_touch_changed BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION deliveries_touch_changed();

-- Avisos dins de l'aplicació ------------------------------------------------
-- Els creen el seguiment (US-09) i les incidències (US-11). `link` és una ruta del frontend
-- (/reservas/…), mai una URL externa.
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  kind        text NOT NULL CHECK (kind ~ '^[a-z_]+$'),
  title       text NOT NULL CHECK (btrim(title) <> '' AND char_length(title) <= 200),
  body        text CHECK (btrim(body) <> '' AND char_length(body) <= 1000),
  link        text CHECK (link ~ '^/[A-Za-z0-9/_?=&%-]*$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
