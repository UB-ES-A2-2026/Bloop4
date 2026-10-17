#!/usr/bin/env bash
# Obre psql contra la base de dades. Accepta SQL per stdin:
#   ./db/psql.sh                       # sessió interactiva
#   ./db/psql.sh < db/queries/examples.sql
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

tty_flag=(-T)
[[ -t 0 ]] && tty_flag=()
$COMPOSE -f "$ROOT_DIR/docker-compose.yml" exec "${tty_flag[@]}" "$DB_SERVICE" \
  psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
