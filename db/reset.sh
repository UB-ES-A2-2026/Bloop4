#!/usr/bin/env bash
# Esborra TOT l'esquema public i el reconstrueix: migracions + seeds. Només per a desenvolupament.
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

psql_exec -c "SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
"$ROOT_DIR/db/migrate.sh"
"$ROOT_DIR/db/seed.sh"
