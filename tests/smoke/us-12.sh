#!/usr/bin/env bash
# Smoke de US-12 · Confirmació de la reserva: checkout amb Idempotency-Key i unitats bloquejades.
# El client és el compte de Mobiliario Turia (també és client), perquè la seva cistella no es barregi
# amb la del client d'exemple.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CJAR=$(login mobiliario@example.com)
curl -fsS -b "$CJAR" -o /dev/null -X PUT "$API_URL/cart" -H 'Content-Type: application/json' \
  -d '{"startsAt":"2030-07-04T10:00:00+02:00","endsAt":"2030-07-05T11:00:00+02:00"}'
curl -fsS -b "$CJAR" -o /dev/null -X POST "$API_URL/cart/items" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$ALTAVOZ\",\"quantity\":2}"
curl -fsS -b "$CJAR" -o /dev/null -X PUT "$API_URL/cart/delivery" -H 'Content-Type: application/json' \
  -d '{"street":"Calle Inventada 7","postalCode":"46002","city":"Valencia",
  "deliveryStartsAt":"2030-07-04T08:00:00+02:00","pickupStartsAt":"2030-07-05T12:00:00+02:00"}'

expect "checkout sense Idempotency-Key → 400" "$(status -b "$CJAR" -X POST "$API_URL/cart/checkout")" 400
BOOKING=$(curl -fsS -b "$CJAR" -X POST "$API_URL/cart/checkout" -H 'Idempotency-Key: ci-checkout-0001' | jq -r '.data.id')
expect "checkout: reserva pendent de pagament" "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$BOOKING" | jq -r '.data.status')" pending_payment
expect "checkout repetit amb la mateixa clau → 200" \
  "$(status -b "$CJAR" -X POST "$API_URL/cart/checkout" -H 'Idempotency-Key: ci-checkout-0001')" 200
expect "altaveu: les 2 unitats de la reserva ja no estan lliures" "$(curl -fsS -G "$API_URL/products/$ALTAVOZ/availability" \
  --data-urlencode 'from=2030-07-04T10:00:00+02:00' --data-urlencode 'to=2030-07-05T11:00:00+02:00' | jq '.data.availableUnits')" 2
expect "cancel·lar la reserva la torna a la cistella" "$(status -b "$CJAR" -X POST "$API_URL/bookings/$BOOKING/cancel")" 204
expect "les unitats tornen a estar lliures" "$(curl -fsS -G "$API_URL/products/$ALTAVOZ/availability" \
  --data-urlencode 'from=2030-07-04T10:00:00+02:00' --data-urlencode 'to=2030-07-05T11:00:00+02:00' | jq '.data.availableUnits')" 4
