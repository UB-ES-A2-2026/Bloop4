-- Seeds · 007 · Riders d'exemple (esquema comú del Sprint 2): el rider dels seeds amb furgoneta i un
-- segon rider amb bicicleta de càrrega. Mateixa contrasenya de desenvolupament que la resta: Bloop4-dev-2026

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM riders) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
SELECT 'b0000000-0000-4000-8000-000000000006', 'rider2@example.com', password_hash, 'Marta Rider', 'active', now()
FROM users WHERE id = 'b0000000-0000-4000-8000-000000000004';

INSERT INTO user_roles (user_id, role) VALUES ('b0000000-0000-4000-8000-000000000006', 'rider');
INSERT INTO terms_consents (user_id, terms_version) VALUES ('b0000000-0000-4000-8000-000000000006', '2026-10');

INSERT INTO riders (user_id, vehicle_type) VALUES
  ('b0000000-0000-4000-8000-000000000004', 'van'),
  ('b0000000-0000-4000-8000-000000000006', 'cargo_bike');
