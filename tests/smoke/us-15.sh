#!/usr/bin/env bash
# Smoke de US-15 · Llista de serveis del rider: els serveis assignats als seeds el 15 i el 16/06/2030.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RJAR=$(login rider@example.com)
export SONIDO_DELIVERY
# L'estat del lliurament pot haver canviat (US-09 l'inicia): es comprova quins serveis hi ha i en quin ordre.
expect "serveis del rider el 15/06/2030" \
  "$(curl -fsS -b "$RJAR" "$API_URL/rider/services?date=2030-06-15" | jq -c '[.data[] | [.id == env.SONIDO_DELIVERY, .seller.legalName]]')" \
  '[[true,"Sonido Levante S.L."],[false,"Mobiliario Eventos Turia S.L."]]'
expect "el servei de la reserva cancel·lada surt com a cancel·lat" \
  "$(curl -fsS -b "$RJAR" "$API_URL/rider/services?date=2030-06-15" | jq -r '.data[1].status')" cancelled
expect "la recollida moguda després d'acceptar-la surt com a modificada" \
  "$(curl -fsS -b "$RJAR" "$API_URL/rider/services/$SONIDO_PICKUP" | jq -r '.data.changedSinceAssigned')" true
expect "data invàlida → 400" "$(status -b "$RJAR" "$API_URL/rider/services?date=15-06-2030")" 400
expect "un dia que no existeix → 400" "$(status -b "$RJAR" "$API_URL/rider/services?date=2030-02-31")" 400
expect "sense sessió → 401" "$(status "$API_URL/rider/services?date=2030-06-15")" 401
R2JAR=$(login rider2@example.com)
expect "un rider no veu el servei d'un altre" "$(status -b "$R2JAR" "$API_URL/rider/services/$SONIDO_DELIVERY")" 404
