#!/usr/bin/env bash
# Aplica, en ordre, les migracions de db/migrations que encara no estiguin registrades
# a schema_migrations. Cada fitxer s'aplica en una única transacció.
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

psql_exec -c "SET client_min_messages = warning; CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for file in "$ROOT_DIR"/db/migrations/*.sql; do
  version="$(basename "$file" .sql)"
  applied="$(psql_exec -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")"
  if [[ "$applied" == "1" ]]; then
    echo "  = $version (ya aplicada)"
    continue
  fi
  echo "  → $version"
  { cat "$file"; printf "\nINSERT INTO schema_migrations (version) VALUES ('%s');\n" "$version"; } \
    | psql_exec --single-transaction
done
echo "Migraciones al día."
