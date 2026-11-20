#!/usr/bin/env bash
# Smoke de US-08 · Pagament amb la passarel·la simulada: la targeta de prova confirma la reserva
# pendent dels seeds i genera el comprovant.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CJAR=$(login cliente@example.com)
PAYURL=$(curl -fsS -b "$CJAR" -X POST "$API_URL/bookings/$PENDING/payment" | jq -r '.data.checkoutUrl')
REF=$(echo "$PAYURL" | sed -E 's/.*[?&]ref=([^&]+).*/\1/')
expect "import a pagar: lloguer + transport" "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$PENDING/payment" | jq -r '.data.amount')" 70.00
expect "webhook sense signatura → 400" "$(status -X POST "$API_URL/payments/webhook" \
  -H 'Content-Type: application/json' -d "{\"type\":\"checkout.succeeded\",\"ref\":\"$REF\"}")" 400
expect "pagament amb targeta de prova" "$(curl -fsS -b "$CJAR" -X POST "$API_URL/payments/mock/complete" \
  -H 'Content-Type: application/json' -d "{\"ref\":\"$REF\",\"cardNumber\":\"4242424242424242\"}" | jq -r '.data.result')" succeeded
expect "reserva confirmada després del pagament" "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$PENDING" | jq -r '.data.status')" confirmed
expect "comprovant de pagament" \
  "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$PENDING/payment" | jq -r '.data.receiptNumber' | grep -c '^R-')" 1
expect "fiança programada per a 7 dies abans del lliurament" \
  "$(curl -fsS -b "$CJAR" "$API_URL/bookings/$PENDING/payment" | jq -r '.data.deposit.status')" scheduled
