#!/usr/bin/env bash
# Smoke del Sprint 1: catàleg, cerca, fitxa, comptes, disponibilitat, cistella, lliurament i venedor.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SONIDO=c0000000-0000-4000-8000-000000000001

expect "14 categories" "$(curl -fsS "$API_URL/categories" | jq '.data | length')" 14
expect "15 productes" "$(curl -fsS "$API_URL/products" | jq '.pagination.totalItems')" 15
expect "5 productes de Sonido (amb subcategories)" \
  "$(curl -fsS "$API_URL/products?categoryId=$SONIDO" | jq '.pagination.totalItems')" 5
expect "pageSize respectat" "$(curl -fsS "$API_URL/products?pageSize=4" | jq '.data | length')" 4
expect "page invàlid → 400" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/products?page=0")" 400
expect "cerca 'microfono' → 2 productes" \
  "$(curl -fsS "$API_URL/products?q=microfono" | jq '.pagination.totalItems')" 2
expect "cerca 'MICRÓFONO' → 2 productes" \
  "$(curl -fsS -G "$API_URL/products" --data-urlencode 'q=MICRÓFONO' | jq '.pagination.totalItems')" 2
expect "q d'1 caràcter → 400" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/products?q=a")" 400

expect "fitxa: fiança de la carpa jaima" \
  "$(curl -fsS "$API_URL/products/$JAIMA" | jq -r '.data.depositAmount')" 400.00
expect "fitxa: 2 imatges" "$(curl -fsS "$API_URL/products/$JAIMA" | jq '.data.images | length')" 2
expect "fitxa amb id invàlid → 400" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/products/123")" 400
expect "registre → 201" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ci@example.com","password":"contrasenya1","fullName":"CI","role":"customer","acceptTerms":true}')" 201
expect "registre amb rol rider → 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ci2@example.com","password":"contrasenya1","fullName":"CI","role":"rider","acceptTerms":true}')" 400
expect "login del client d'exemple → 200" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"cliente@example.com","password":"Bloop4-dev-2026"}')" 200
expect "me sense sessió → 401" "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auth/me")" 401

# Disponibilitat (US-05) amb les reserves dels seeds del 15/06/2030.

expect "altaveu: 1 unitat lliure durant la reserva" "$(curl -fsS -G "$API_URL/products/$ALTAVOZ/availability" \
  --data-urlencode 'from=2030-06-15T18:00:00+02:00' --data-urlencode 'to=2030-06-15T23:00:00+02:00' \
  | jq '.data.availableUnits')" 1
expect "disponibilitat sense zona horària → 400" "$(curl -s -o /dev/null -w '%{http_code}' -G \
  "$API_URL/products/$ALTAVOZ/availability" --data-urlencode 'from=2030-06-15T18:00' --data-urlencode 'to=2030-06-15T23:00')" 400
expect "calendari de la carpa jaima: 4 dies ocupats" \
  "$(curl -fsS "$API_URL/products/$JAIMA/availability/calendar?month=2030-06" | jq '.data.unavailableDays | length')" 4

# Cistella (US-06): el client d'exemple hi afegeix 2 altaveus per 25 h (2 dies).
CJAR=$(mktemp)
curl -fsS -c "$CJAR" -o /dev/null -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"cliente@example.com","password":"Bloop4-dev-2026"}'
curl -fsS -b "$CJAR" -o /dev/null -X PUT "$API_URL/cart" -H 'Content-Type: application/json' \
  -d '{"startsAt":"2030-07-04T10:00:00+02:00","endsAt":"2030-07-05T11:00:00+02:00"}'
expect "cistella: 2 altaveus × 2 dies = 180.00" "$(curl -fsS -b "$CJAR" -X POST "$API_URL/cart/items" \
  -H 'Content-Type: application/json' -d "{\"productId\":\"$ALTAVOZ\",\"quantity\":2}" | jq -r '.data.totals.rental')" 180.00
expect "cistella: més unitats de les que hi ha → 409" "$(curl -s -o /dev/null -w '%{http_code}' -b "$CJAR" \
  -X POST "$API_URL/cart/items" -H 'Content-Type: application/json' -d "{\"productId\":\"$ALTAVOZ\",\"quantity\":3}")" 409

# Lliurament (US-07) de la cistella anterior: cotxe (25 €) i fora de cobertura a Barcelona.
expect "franges fora de cobertura → OUT_OF_COVERAGE" "$(curl -s -b "$CJAR" \
  "$API_URL/delivery-slots?postalCode=08001&date=2030-07-04" | jq -r '.error.code')" OUT_OF_COVERAGE
expect "lliurament desat: transport 25.00" "$(curl -fsS -b "$CJAR" -X PUT "$API_URL/cart/delivery" \
  -H 'Content-Type: application/json' -d '{"street":"Calle Ficticia 9","postalCode":"46001","city":"Valencia",
  "deliveryStartsAt":"2030-07-04T08:00:00+02:00","pickupStartsAt":"2030-07-05T12:00:00+02:00"}' | jq -r '.data.transportTotal')" 25.00
expect "total a pagar = lloguer + transport" "$(curl -fsS -b "$CJAR" "$API_URL/cart" | jq -r '.data.totals.toPay')" 205.00

# Venedor (US-10): un esborrany no surt al catàleg i no es pot publicar sense fotos.
JAR=$(mktemp)
curl -fsS -c "$JAR" -o /dev/null -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"mobiliario@example.com","password":"Bloop4-dev-2026"}'
DRAFT=$(curl -fsS -b "$JAR" -X POST "$API_URL/seller/products" -H 'Content-Type: application/json' \
  -d '{"name":"Esborrany CI","categoryId":"c0000000-0000-4000-8000-000000000010","dailyPrice":"2"}' | jq -r '.data.id')
expect "esborrany fora del catàleg" "$(curl -fsS "$API_URL/products" | jq '.pagination.totalItems')" 15
expect "publicar sense fotos → 400" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$API_URL/seller/products/$DRAFT/publish")" 400
expect "un client no entra al panell del venedor" "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/seller/products")" 401
expect "fitxa inexistent → 404" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/products/d0000000-0000-4000-8000-000000000099")" 404
