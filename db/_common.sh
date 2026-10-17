#!/usr/bin/env bash
# Utilitats compartides pels scripts de db/. No s'executa directament.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

COMPOSE="${COMPOSE:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-eventrent}"
POSTGRES_DB="${POSTGRES_DB:-eventrent}"

# Executa psql dins del contenidor llegint SQL per stdin o amb -c.
psql_exec() {
  $COMPOSE -f "$ROOT_DIR/docker-compose.yml" exec -T "$DB_SERVICE" \
    psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}
