-- Seeds · 003 · Un usuari de cada rol (només correus @example.com) i els dos venedors d'exemple
-- enllaçats amb el seu compte. Contrasenya de tots, NOMÉS per a desenvolupament: Bloop4-dev-2026

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'cliente@example.com',
   'scrypt$16384$8$1$cpbUtTRi6mubS3W9LwvYUw==$4dCqBr5id9CZkcMsanHJQstNucTIZBZwSkNxHVT3G1iXlu04mqw98e47S13ZEQNDjJYUjpogzkXBK/ZI8inw0A==',
   'Laura Cliente', 'active', now()),
  ('b0000000-0000-4000-8000-000000000002', 'sonido@example.com',
   'scrypt$16384$8$1$SWtVIqTDq08SuJqWKKz2qg==$Cc5D+O6b9LXwPBJ8CqSSy1XRZYh/C9KAhe5Rv53DRaWieD3FpBLJwDwakO15j2upD5qBwcz2eKEcRCEYB+qyBw==',
   'Marc Sonido Levante', 'active', now()),
  ('b0000000-0000-4000-8000-000000000003', 'mobiliario@example.com',
   'scrypt$16384$8$1$EUsXBcTjvfoUETnIj0dOjg==$wUy6Gr6vEKUbQoLhiCwBhnNyhC2NxupVlSIgpsvcB6sLGbqrwVAWk3+axD4shZoTM/cPx05uY1HciyC03U8wgA==',
   'Ana Mobiliario Turia', 'active', now()),
  ('b0000000-0000-4000-8000-000000000004', 'rider@example.com',
   'scrypt$16384$8$1$eKWoFBYLVq47beD3fwA3Kg==$AUx25u/MnfblbonjI/fOL23TYspN5/lpIOyqUsGTMnjockWBK9IuQzKVy8XVlycopPTn+QeepRC1q7gNHkOkdQ==',
   'Pau Rider', 'active', now()),
  ('b0000000-0000-4000-8000-000000000005', 'admin@example.com',
   'scrypt$16384$8$1$CWL7VlV6LipZy33ZbUa6SQ==$AQezPmiteRJ6Z3Rx9L34NxCxfewz6/KusmesuP3Dl2Ue0wf3fLFFoV9+mIQkYjHZ6IU5LqpdcCAhIGEFKosHnw==',
   'Admin Bloop4', 'active', now());

INSERT INTO user_roles (user_id, role) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'customer'),
  ('b0000000-0000-4000-8000-000000000002', 'seller'),
  ('b0000000-0000-4000-8000-000000000003', 'seller'),
  ('b0000000-0000-4000-8000-000000000003', 'customer'),
  ('b0000000-0000-4000-8000-000000000004', 'rider'),
  ('b0000000-0000-4000-8000-000000000005', 'admin');

UPDATE sellers SET user_id = 'b0000000-0000-4000-8000-000000000002' WHERE id = 'a0000000-0000-4000-8000-000000000001';
UPDATE sellers SET user_id = 'b0000000-0000-4000-8000-000000000003' WHERE id = 'a0000000-0000-4000-8000-000000000002';

INSERT INTO terms_consents (user_id, terms_version)
SELECT id, '2026-10' FROM users;
