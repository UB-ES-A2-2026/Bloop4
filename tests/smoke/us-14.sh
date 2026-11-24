#!/usr/bin/env bash
# Smoke de US-14 · Acceptació de serveis: el rider veu els serveis pendents sense l'adreça del client
# i n'accepta un (la recollida de Mobiliario del 17/06 dels seeds).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RJAR=$(login rider@example.com)
CJAR=$(login cliente@example.com)
expect "la recollida del 17/06 està disponible" \
  "$(curl -fsS -b "$RJAR" "$API_URL/rider/services/available" | jq --arg id "$TURIA_PICKUP" '[.data[] | select(.id == $id)] | length')" 1
expect "serveis disponibles sense l'adreça del client" \
  "$(curl -fsS -b "$RJAR" "$API_URL/rider/services/available" | jq '[.data[] | select(has("address"))] | length')" 0
expect "el rider accepta el servei" \
  "$(curl -fsS -b "$RJAR" -X POST "$API_URL/rider/services/$TURIA_PICKUP/accept" | jq -r '.data.status')" assigned
expect "un cop acceptat, veu l'adreça" \
  "$(curl -fsS -b "$RJAR" -X POST "$API_URL/rider/services/$TURIA_PICKUP/accept" | jq -r '.data.address.street')" 'Calle Ficticia 1'
R2JAR=$(login rider2@example.com)
expect "un altre rider ja no el pot acceptar" "$(status -b "$R2JAR" -X POST "$API_URL/rider/services/$TURIA_PICKUP/accept")" 409
expect "un client no veu els serveis dels riders" "$(status -b "$CJAR" "$API_URL/rider/services/available")" 403
