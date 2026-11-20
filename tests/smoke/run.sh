#!/usr/bin/env bash
# Executa tots els scripts de smoke (sprint1.sh i un per història) contra l'API d'API_URL, que ha
# d'estar en marxa amb una base de dades amb els seeds acabats de carregar. Cada script és
# independent: l'ordre no importa. Falla si en falla algun.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
failed=()
for script in sprint1.sh us-*.sh; do
  [ -f "$script" ] || continue
  echo "── $script"
  bash "$script" || failed+=("$script")
done
if [ ${#failed[@]} -gt 0 ]; then
  echo "✗ Han fallat: ${failed[*]}"
  exit 1
fi
