import { createMockGateway } from './mockGateway.js';
import { createStripeGateway } from './stripeGateway.js';

/**
 * Passarel·la de pagament (US-08). La resta de l'API només coneix aquesta interfície; quina
 * implementació s'utilitza es tria amb PAYMENT_PROVIDER:
 *   · `stripe`: Stripe Checkout (pàgina de pagament allotjada per Stripe) i webhook signat.
 *   · `mock`:   passarel·la simulada per a desenvolupament i CI, sense claus ni xarxa.
 *
 * Totes dues implementen:
 *   name
 *   createCheckout({ paymentId, bookingNumber, amountMinor, currency, customerEmail, successUrl, cancelUrl })
 *       → { ref, url }   sessió de pagament i pàgina on el client introdueix la targeta
 *   expireCheckout(ref)                 tanca una sessió que ja no s'ha de poder pagar
 *   parseWebhook(rawBody, headers)      comprova la signatura i tradueix l'avís a
 *       { id, type: 'checkout.succeeded' | 'checkout.failed' | 'checkout.expired', ref, chargeRef, customerRef, reason }
 *       (null si és un avís que no ens interessa). Llança WebhookSignatureError si no és autèntic.
 *   refund(chargeRef)                   retorna un cobrament
 *   holdDeposit({ eventId, bookingNumber, amountMinor, currency, customerRef, chargeRef })
 *       → { ref }   reté la fiança a la targeta del pagament sense cobrar-la.
 *       Llança PaymentDeclinedError si la targeta la rebutja.
 *   releaseDeposit(ref)                 allibera una fiança retinguda
 *
 * Els imports viatgen en la unitat mínima de la moneda (cèntims) com a enter.
 */

/** La signatura del webhook no és vàlida: l'avís no ve de la passarel·la. */
export class WebhookSignatureError extends Error {}

/** La passarel·la ha rebutjat l'operació amb la targeta (sense fons, caducada…). */
export class PaymentDeclinedError extends Error {}

export function createPaymentGateway({
  provider = process.env.PAYMENT_PROVIDER ?? 'mock',
  appUrl = process.env.APP_URL ?? 'http://localhost:8080',
  stripeSecretKey = process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
  mockSecret = process.env.MOCK_PAYMENT_SECRET,
} = {}) {
  if (provider === 'stripe') {
    if (!stripeSecretKey || !stripeWebhookSecret) {
      throw new Error('PAYMENT_PROVIDER=stripe necesita STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET');
    }
    return createStripeGateway({ secretKey: stripeSecretKey, webhookSecret: stripeWebhookSecret });
  }
  if (provider === 'mock') return createMockGateway({ appUrl, secret: mockSecret });
  throw new Error(`PAYMENT_PROVIDER desconocido: ${provider} (valores admitidos: stripe, mock)`);
}
