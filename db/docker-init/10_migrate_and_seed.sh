#!/usr/bin/env bash
# Inicialitzación del contenidor de la Basede Dades PostgreSQL

# Aquest script fa el que faria el migrate i el seed de la database però dins el propi contenirdor
# D'aquesta manera estim aplicant cada migració a la seva transacció i la registrem a l'schema de migracions
# aixi el migrate de database el podrà reconeixer com que ha estat aplicat a través de l'esquema
# Per últim carrega les seeds en ordre

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/bloop4/migrations}"
SEEDS_DIR="${SEEDS_DIR:-/bloop4/seeds}"

run_psql() {
  psql -X -q -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$@"
}

run_psql -c "SET client_min_messages = warning; CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  echo "[bloop4-init] migración $version"
  { cat "$file"; printf "\nINSERT INTO schema_migrations (version) VALUES ('%s');\n" "$version"; } \
    | run_psql --single-transaction
done

if [[ "${SKIP_SEEDS:-false}" != "true" ]]; then
  for file in "$SEEDS_DIR"/*.sql; do
    echo "[bloop4-init] seed $(basename "$file")"
    run_psql --single-transaction < "$file"
  done
fi

echo "[bloop4-init] base de datos lista"
