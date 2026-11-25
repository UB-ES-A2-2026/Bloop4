#!/usr/bin/env bash
# Smoke de US-09 · Seguiment: el rider inicia el lliurament de Sonido del 15/06 i el client ho veu,
# amb un avís dins de l'aplicació.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RJAR=$(login rider@example.com)
CJAR=$(login cliente@example.com)
UNREAD=$(curl -fsS -b "$CJAR" "$API_URL/notifications" | jq '.unreadCount')
expect "una recollida no comença abans del lliurament" \
  "$(curl -s -b "$RJAR" -X POST "$API_URL/rider/services/$SONIDO_PICKUP/start" | jq -r '.error.details.reason')" DELIVERY_NOT_DONE
expect "el rider inicia el lliurament" \
  "$(curl -fsS -b "$RJAR" -X POST "$API_URL/rider/services/$SONIDO_DELIVERY/start" | jq -r '.data.status')" in_transit
expect "no es pot iniciar dues vegades" "$(status -b "$RJAR" -X POST "$API_URL/rider/services/$SONIDO_DELIVERY/start")" 409
expect "el client veu la fase «en camí»" "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$SEEDED/tracking" \
  | jq -r '.data.sellers[] | select(.seller.legalName == "Sonido Levante S.L.") | .phase')" delivery_in_transit
expect "el client té un avís nou sense llegir" "$(curl -fsS -b "$CJAR" "$API_URL/notifications" | jq '.unreadCount')" $((UNREAD + 1))
expect "marcar-los tots com a llegits" "$(status -b "$CJAR" -X POST "$API_URL/notifications/read-all")" 204
expect "un altre client no veu el seguiment" "$(status -b "$(login mobiliario@example.com)" "$API_URL/bookings/$SEEDED/tracking")" 403
