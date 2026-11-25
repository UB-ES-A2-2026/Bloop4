#!/usr/bin/env bash
# Smoke de US-16 · Mapa: el rider comparteix la posició del lliurament en curs de Sonido del 20/07 i
# el client el veu; un lliurament que encara no ha sortit no en té.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RJAR=$(login rider@example.com)
CJAR=$(login cliente@example.com)
expect "ubicació d'un lliurament que no ha sortit → 409" "$(status -b "$RJAR" -X POST \
  "$API_URL/rider/services/$TURIA_DELIVERY/location" -H 'Content-Type: application/json' -d '{"latitude":39.47,"longitude":-0.376}')" 409
expect "el rider envia la ubicació" "$(status -b "$RJAR" -X POST \
  "$API_URL/rider/services/$MAP_DELIVERY/location" -H 'Content-Type: application/json' -d '{"latitude":39.47,"longitude":-0.376}')" 204
expect "massa sovint → 429" "$(status -b "$RJAR" -X POST \
  "$API_URL/rider/services/$MAP_DELIVERY/location" -H 'Content-Type: application/json' -d '{"latitude":39.47,"longitude":-0.376}')" 429
expect "coordenades fora de rang → 400" "$(status -b "$RJAR" -X POST \
  "$API_URL/rider/services/$MAP_DELIVERY/location" -H 'Content-Type: application/json' -d '{"latitude":91,"longitude":0}')" 400
expect "el client veu on és el rider" \
  "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$IN_TRANSIT/locations" | jq -r --arg id "$MAP_DELIVERY" '.data[] | select(.serviceId == $id) | .location.latitude')" 39.47
