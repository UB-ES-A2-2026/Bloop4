import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PaymentDeclinedError, WebhookSignatureError } from './gateway.js';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** Targetes de prova de la passarel·la simulada (les mateixes que fa servir Stripe en mode test). */
export const MOCK_CARDS = {
  ok: '4242424242424242',
  declined: '4000000000000002',
  // Paga bé, però després rebutja la retenció de la fiança.
  depositDeclined: '4000000000000341',
};

/**
 * Passarel·la simulada: no cobra res ni surt a la xarxa. Fa el mateix recorregut que Stripe: es
 * crea una sessió, el client «paga» a la pàgina de proves del frontend (/pago-simulado) i el
 * resultat arriba al mateix webhook, signat amb HMAC-SHA256.
 */
export function createMockGateway({ appUrl = 'http://localhost:8080', secret } = {}) {
  // Sense secret configurat se'n genera un per procés: només el servidor pot signar avisos.
  const key = secret ?? randomBytes(32).toString('hex');
  const sign = (body) => createHmac('sha256', key).update(body).digest('hex');

  return {
    name: 'mock',

    async createCheckout({ successUrl, cancelUrl }) {
      const ref = `mock_cs_${randomUUID()}`;
      const query = new URLSearchParams({ ref, ok: successUrl, cancel: cancelUrl });
      return { ref, url: `${appUrl}/pago-simulado?${query}` };
    },

    async expireCheckout() {},

    parseWebhook(rawBody, headers) {
      const received = Buffer.from(String(headers[MOCK_SIGNATURE_HEADER] ?? ''), 'utf8');
      const expected = Buffer.from(sign(rawBody), 'utf8');
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        throw new WebhookSignatureError('Firma del webhook no válida');
      }
      const event = JSON.parse(rawBody.toString('utf8'));
      if (!['checkout.succeeded', 'checkout.failed', 'checkout.expired'].includes(event.type)) return null;
      return {
        id: event.id,
        type: event.type,
        ref: event.ref,
        chargeRef: event.chargeRef ?? null,
        customerRef: event.customerRef ?? null,
        reason: event.reason ?? null,
      };
    },

    async refund() {},

    async holdDeposit({ customerRef }) {
      if (String(customerRef).endsWith(MOCK_CARDS.depositDeclined.slice(-4))) {
        throw new PaymentDeclinedError('La tarjeta ha rechazado la retención de la fianza');
      }
      return { ref: `mock_hold_${randomUUID()}` };
    },

    async releaseDeposit() {},

    /**
     * Avís signat com els que enviaria la passarel·la, a partir de la targeta de prova que ha
     * escrit el client. El fan servir la ruta de la pàgina de pagament simulada i els tests.
     * @returns {{ body: Buffer, headers: object, type: string }}
     */
    buildEvent({ ref, cardNumber, type }) {
      const card = String(cardNumber ?? '').replace(/\s+/g, '');
      if (!type && !Object.values(MOCK_CARDS).includes(card)) {
        throw new PaymentDeclinedError('Usa una tarjeta de prueba: 4242 4242 4242 4242');
      }
      const declined = card === MOCK_CARDS.declined;
      const event = {
        id: `mock_evt_${randomUUID()}`,
        type: type ?? (declined ? 'checkout.failed' : 'checkout.succeeded'),
        ref,
        // La «targeta» només es recorda pels últims 4 dígits, com a referència opaca.
        chargeRef: `mock_ch_${randomUUID()}`,
        customerRef: `mock_cus_${card.slice(-4) || '0000'}`,
        reason: declined ? 'La tarjeta ha sido rechazada' : null,
      };
      const body = Buffer.from(JSON.stringify(event), 'utf8');
      return { body, headers: { [MOCK_SIGNATURE_HEADER]: sign(body) }, type: event.type };
    },
  };
}
