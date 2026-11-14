#!/usr/bin/env bash
# Executa les proves d'integritat (necessiten els seeds). Tot es fa dins d'una
# transacció que acaba en ROLLBACK, així que no modifica les dades.
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

psql_exec -o /dev/null < "$ROOT_DIR/db/tests/integrity_tests.sql"
