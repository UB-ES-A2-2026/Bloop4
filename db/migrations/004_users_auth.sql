-- 004 · Usuaris, rols i sessions (US-13).
-- Un usuari pot tenir diversos rols (client i venedor alhora). El perfil de venedor és la
-- fila de `sellers` (la del catàleg) enllaçada amb l'usuari. Les contrasenyes es guarden com a
-- hash scrypt i els tokens (sessió i verificació) només com a hash SHA-256.

CREATE TABLE IF NOT EXISTS users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sempre en minúscules: la unicitat no depèn de com l'escrigui l'usuari.
  email              text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash      text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  full_name          text NOT NULL CHECK (btrim(full_name) <> ''),
  status             text NOT NULL DEFAULT 'pending_verification'
                     CHECK (status IN ('pending_verification', 'active', 'suspended')),
  email_verified_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- Un compte actiu ha d'haver verificat el correu.
  CHECK (status <> 'active' OR email_verified_at IS NOT NULL)
);

-- Catàleg de rols. rider i admin només els assigna un administrador.
CREATE TABLE IF NOT EXISTS roles (
  code  text PRIMARY KEY CHECK (code ~ '^[a-z]+$'),
  name  text NOT NULL CHECK (btrim(name) <> '')
);
INSERT INTO roles (code, name) VALUES
  ('customer', 'Cliente'),
  ('seller',   'Empresa arrendadora'),
  ('rider',    'Repartidor'),
  ('admin',    'Administrador')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  role        text NOT NULL REFERENCES roles (code) ON DELETE RESTRICT,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- Perfil de venedor: l'usuari que gestiona aquest venedor. NULL = venedor sense compte.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES users (id) ON DELETE RESTRICT;

-- Sessions del navegador (cookie httpOnly). Només es guarda el hash del token.
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- Enllaços de verificació del correu (caduquen a les 24 h i només es poden fer servir un cop).
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash  text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);

-- Intents d'inici de sessió, per limitar-los per compte i per IP (5 fallits cada 15 min).
CREATE TABLE IF NOT EXISTS login_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  ip            inet NOT NULL,
  succeeded     boolean NOT NULL,
  attempted_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, attempted_at);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, attempted_at);

-- Consentiment RGPD: quina versió dels termes ha acceptat cada usuari i quan.
CREATE TABLE IF NOT EXISTS terms_consents (
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  terms_version  text NOT NULL CHECK (btrim(terms_version) <> ''),
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);
