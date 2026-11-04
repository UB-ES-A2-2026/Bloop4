#!/usr/bin/env bash
# Desplega una versió a l'entorn d'aquest directori de la VM (producció o staging).
# GitHub Actions l'executa per SSH després de fer el checkout del commit:
#   cd /opt/bloop4/staging && ./deploy/deploy.sh <sha> [--reset-db]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

export IMAGE_TAG="${1:?Ús: deploy/deploy.sh <sha> [--reset-db]}"
RESET_DB="${2:-}"

compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }
project="$(compose config | sed -n 's/^name: //p')"

echo "→ [$project] Baixant les imatges $IMAGE_TAG"
compose pull --quiet

echo "→ [$project] Base de dades"
compose up -d --wait db

if [[ "$RESET_DB" == "--reset-db" ]]; then
  [[ "$project" != "bloop4-prod" ]] || { echo "No es pot esborrar la base de dades de producció" >&2; exit 1; }
  echo "→ [$project] Esborrant la base de dades i tornant a carregar els seeds"
  ./db/reset.sh
else
  echo "→ [$project] Migracions pendents"
  ./db/migrate.sh
fi

echo "→ [$project] API i frontend"
compose up -d --no-build --wait --remove-orphans

echo "→ [$project] Contrasenya dels comptes d'exemple"
./deploy/demo-passwords.sh

docker image prune -af > /dev/null # Esborra les imatges que ja no fa servir cap contenidor
echo "✓ [$project] Desplegat $IMAGE_TAG"
