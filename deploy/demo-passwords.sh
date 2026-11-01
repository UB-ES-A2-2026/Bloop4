#!/usr/bin/env bash
# Posa DEMO_PASSWORD (del .env) com a contrasenya dels comptes d'exemple (@example.com).
# La dels seeds és al repositori, que és públic: a la VM no ha de servir per entrar.
source "$(dirname "${BASH_SOURCE[0]}")/../db/_common.sh"

# Sense aquest fitxer l'API encara no té inici de sessió: no cal canviar res.
[[ -f "$ROOT_DIR/api/src/auth/password.js" ]] || { echo "Encara no hi ha inici de sessió: no es canvia cap contrasenya"; exit 0; }

: "${DEMO_PASSWORD:?Falta DEMO_PASSWORD al .env}"
hash="$($COMPOSE -f "$ROOT_DIR/docker-compose.yml" exec -T -e DEMO_PASSWORD api node --input-type=module -e \
  "import { hashPassword } from './src/auth/password.js'; console.log(await hashPassword(process.env.DEMO_PASSWORD));")"
psql_exec -v hash="$hash" <<'SQL'
UPDATE users SET password_hash = :'hash' WHERE email LIKE '%@example.com';
SQL
