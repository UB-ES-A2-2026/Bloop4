#!/usr/bin/env bash
# Carrega les dades d'exemple de db/seeds. Només s'ha d'executar sobre una base
# acabada de migrar (els seeds es neguen a carregar-se dues vegades).
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

for file in "$ROOT_DIR"/db/seeds/*.sql; do
  echo "  → $(basename "$file")"
  psql_exec --single-transaction < "$file"
done
echo "Seeds cargados."
