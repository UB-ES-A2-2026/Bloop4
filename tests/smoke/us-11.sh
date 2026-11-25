#!/usr/bin/env bash
# Smoke de US-11 · Prova de lliurament: el rider completa el lliurament en curs de Mobiliario del 20/07
# amb la foto i el checklist de les cadires; la foto és privada.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RJAR=$(login rider@example.com)
CJAR=$(login cliente@example.com)
R2JAR=$(login rider2@example.com)
PHOTO=$(mktemp --suffix=.jpg)
printf '\xff\xd8\xff\xe0proves' > "$PHOTO"
expect "completar sense foto → 400" "$(status -b "$RJAR" -X POST "$API_URL/rider/services/$PROOF_DELIVERY/complete" \
  -H 'Content-Type: application/json' -d "{\"items\":[{\"eventItemId\":\"$PROOF_ITEM\",\"condition\":\"correct\"}]}")" 400
PHOTO_URL=$(curl -fsS -b "$RJAR" -F "photo=@$PHOTO" -F eventItemId=$PROOF_ITEM \
  "$API_URL/rider/services/$PROOF_DELIVERY/photos" | jq -r '.data.url')
expect "servei completat amb la prova" "$(curl -fsS -b "$RJAR" -X POST "$API_URL/rider/services/$PROOF_DELIVERY/complete" \
  -H 'Content-Type: application/json' -d "{\"items\":[{\"eventItemId\":\"$PROOF_ITEM\",\"condition\":\"correct\"}]}" \
  | jq -r '.data.status')" delivered
expect "el client veu la prova" "$(curl -fsS -b "$CJAR" "$API_URL/services/$PROOF_DELIVERY/proof" | jq -r '.data.items[0].condition')" correct
expect "el client veu la foto" "$(status -b "$CJAR" "${API_URL%/api}$PHOTO_URL")" 200
expect "un altre rider no veu la foto" "$(status -b "$R2JAR" "${API_URL%/api}$PHOTO_URL")" 404
expect "sense sessió no es veu la foto" "$(status "${API_URL%/api}$PHOTO_URL")" 401
