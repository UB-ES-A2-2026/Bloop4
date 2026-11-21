import Stripe from 'stripe';
import { PaymentDeclinedError, WebhookSignatureError } from './gateway.js';

// Stripe no admet sessions de Checkout de menys de 30 minuts.
const CHECKOUT_TTL_SECONDS = 30 * 60;

/**
 * Stripe Checkout: el client introdueix la targeta a la pàgina de Stripe (mai a la nostra) i el
 * resultat arriba pel webhook, signat amb STRIPE_WEBHOOK_SECRET. `client` s'injecta als tests.
 */
export function createStripeGateway({ secretKey, webhookSecret, client = new Stripe(secretKey), now = () => Date.now() }) {
  return {
    name: 'stripe',

    async createCheckout({ paymentId, bookingNumber, amountMinor, currency, customerEmail, successUrl, cancelUrl }) {
      const session = await client.checkout.sessions.create(
        {
          mode: 'payment',
          // Etiqueta per distingir aquest flux al Dashboard de Stripe.
          integration_identifier: 'bloop4-booking-checkout-qhzvmtkd',
          client_reference_id: paymentId,
          customer_email: customerEmail,
          // Es crea un client de Stripe i es desa la targeta per poder retenir després la fiança.
          customer_creation: 'always',
          payment_intent_data: { setup_future_usage: 'off_session', metadata: { bookingNumber } },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: currency.toLowerCase(),
                unit_amount: amountMinor,
                product_data: { name: `Reserva ${bookingNumber} · Bloop4` },
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          expires_at: Math.floor(now() / 1000) + CHECKOUT_TTL_SECONDS,
          metadata: { paymentId, bookingNumber },
        },
        // Si la petició es repeteix (reintent de xarxa), Stripe retorna la mateixa sessió.
        { idempotencyKey: `checkout-${paymentId}` },
      );
      return { ref: session.id, url: session.url };
    },

    async expireCheckout(ref) {
      // Si la sessió ja s'ha pagat o ja ha caducat, Stripe respon amb un error que no cal propagar.
      await client.checkout.sessions.expire(ref).catch(() => {});
    },

    parseWebhook(rawBody, headers) {
      let event;
      try {
        event = client.webhooks.constructEvent(rawBody, headers['stripe-signature'], webhookSecret);
      } catch {
        throw new WebhookSignatureError('Firma del webhook no válida');
      }
      const session = event.data.object;
      const base = {
        id: event.id,
        ref: session.id,
        chargeRef: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
        customerRef: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
        reason: null,
      };
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          // Amb mètodes de pagament diferits la sessió es completa abans de cobrar: s'espera.
          return session.payment_status === 'paid' ? { ...base, type: 'checkout.succeeded' } : null;
        case 'checkout.session.async_payment_failed':
          return { ...base, type: 'checkout.failed', reason: 'El pago no se ha podido completar' };
        case 'checkout.session.expired':
          return { ...base, type: 'checkout.expired' };
        default:
          return null;
      }
    },

    async refund(chargeRef) {
      await client.refunds.create({ payment_intent: chargeRef }, { idempotencyKey: `refund-${chargeRef}` });
    },

    /**
     * Retenció de la fiança: una autorització (PaymentIntent amb captura manual) sobre la targeta
     * desada en el pagament, sense el client present. No es captura mai des d'aquí. Stripe manté
     * l'autorització uns 7 dies: per això es fa, com a molt, 7 dies abans del lliurament.
     */
    async holdDeposit({ eventId, bookingNumber, amountMinor, currency, customerRef, chargeRef }) {
      try {
        const paid = await client.paymentIntents.retrieve(chargeRef);
        const paymentMethod = typeof paid.payment_method === 'string' ? paid.payment_method : paid.payment_method?.id;
        const hold = await client.paymentIntents.create(
          {
            amount: amountMinor,
            currency: currency.toLowerCase(),
            customer: customerRef,
            payment_method: paymentMethod,
            capture_method: 'manual',
            off_session: true,
            confirm: true,
            description: `Fianza de la reserva ${bookingNumber} · Bloop4`,
            metadata: { eventId, bookingNumber, kind: 'deposit_hold' },
          },
          { idempotencyKey: `deposit-${eventId}-${Math.floor(now() / 3_600_000)}` },
        );
        if (hold.status !== 'requires_capture') {
          throw new PaymentDeclinedError('La tarjeta necesita una verificación adicional para retener la fianza');
        }
        return { ref: hold.id };
      } catch (err) {
        if (err instanceof PaymentDeclinedError) throw err;
        if (err?.type === 'StripeCardError') throw new PaymentDeclinedError(err.message);
        throw err;
      }
    },

    async releaseDeposit(ref) {
      await client.paymentIntents.cancel(ref);
    },
  };
}
