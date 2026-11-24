#!/usr/bin/env bash
# Smoke de US-04 · Valoracions: l'altaveu té 2 valoracions (mitjana 4,5); el client valora els micròfons
# de la seva reserva finalitzada de l'octubre, i una reserva no finalitzada no deixa valorar.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MICRO=d0000000-0000-4000-8000-000000000004
CJAR=$(login cliente@example.com)
expect "valoració mitjana de l'altaveu" "$(curl -fsS "$API_URL/products/$ALTAVOZ" | jq -c '.data.rating')" '{"average":"4.5","count":2}'
expect "valorar sense sessió → 401" "$(status -X POST "$API_URL/products/$MICRO/reviews" \
  -H 'Content-Type: application/json' -d "{\"bookingId\":\"$FINISHED\",\"rating\":5}")" 401
expect "el client pot valorar els micròfons" \
  "$(curl -fsS -b "$CJAR" "$API_URL/products/$MICRO/reviews/eligibility" | jq -r '.data.canReview')" true
expect "valoració publicada" "$(status -b "$CJAR" -X POST "$API_URL/products/$MICRO/reviews" \
  -H 'Content-Type: application/json' -d "{\"bookingId\":\"$FINISHED\",\"rating\":5,\"comment\":\"Perfectos\"}")" 201
expect "dues vegades → 409" "$(status -b "$CJAR" -X POST "$API_URL/products/$MICRO/reviews" \
  -H 'Content-Type: application/json' -d "{\"bookingId\":\"$FINISHED\",\"rating\":1}")" 409
expect "una reserva no finalitzada no deixa valorar" "$(curl -s -b "$CJAR" -X POST "$API_URL/products/$JAIMA/reviews" \
  -H 'Content-Type: application/json' -d "{\"bookingId\":\"$SEEDED\",\"rating\":5}" | jq -r '.error.details.reason')" NOT_FINISHED
