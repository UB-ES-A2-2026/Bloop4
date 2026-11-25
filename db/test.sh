#!/usr/bin/env bash
# Executa les proves d'integritat (necessiten els seeds): un fitxer per migració a
# db/tests/integrity/. Cada fitxer es fa dins d'una transacció que acaba en ROLLBACK, així que no
# modifica les dades.
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

cd "$ROOT_DIR/db/tests/integrity"
for file in [0-9]*.sql; do
  echo "  → $file"
  cat _helpers.sql "$file" | psql_exec -o /dev/null
done
