import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createPaymentGateway, PaymentDeclinedError, WebhookSignatureError } from '../src/payments/gateway.js';
import { createMockGateway, MOCK_CARDS, MOCK_SIGNATURE_HEADER } from '../src/payments/mockGateway.js';
import { createStripeGateway } from '../src/payments/stripeGateway.js';

describe('createPaymentGateway', () => {
  it('tria la implementació amb PAYMENT_PROVIDER i exigeix les claus de Stripe', () => {
    assert.equal(createPaymentGateway({ provider: 'mock' }).name, 'mock');
    assert.equal(createPaymentGateway({ provider: 'stripe', stripeSecretKey: 'sk_test_x', stripeWebhookSecret: 'whsec_x' }).name, 'stripe');
    assert.throws(() => createPaymentGateway({ provider: 'stripe', stripeSecretKey: 'sk_test_x', stripeWebhookSecret: undefined }), /STRIPE_WEBHOOK_SECRET/);
    assert.throws(() => createPaymentGateway({ provider: 'paypal' }), /desconocido/);
  });
});

describe('passarel·la simulada', () => {
  const gateway = createMockGateway({ appUrl: 'http://app.test', secret: 'secret-de-prova' });

  it('crea una sessió que porta a la pàgina de pagament simulat amb les URL de tornada', async () => {
    const { ref, url } = await gateway.createCheckout({ successUrl: 'http://app.test/reservas/1?pago=ok', cancelUrl: 'http://app.test/reservas/1?pago=cancelado' });
    assert.match(ref, /^mock_cs_/);
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/pago-simulado');
    assert.equal(parsed.searchParams.get('ref'), ref);
    assert.equal(parsed.searchParams.get('ok'), 'http://app.test/reservas/1?pago=ok');
  });

  it('un avís signat pel servidor es verifica i es tradueix', () => {
    const event = gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: '4242 4242 4242 4242' });
    const parsed = gateway.parseWebhook(event.body, event.headers);
    assert.equal(parsed.type, 'checkout.succeeded');
    assert.equal(parsed.ref, 'mock_cs_1');
    assert.equal(parsed.customerRef, 'mock_cus_4242');
    assert.equal(gateway.parseWebhook(...Object.values(gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.declined })).slice(0, 2)).type, 'checkout.failed');
  });

  it('rebutja un avís sense signatura, amb el cos manipulat o signat amb un altre secret', () => {
    const event = gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok });
    assert.throws(() => gateway.parseWebhook(event.body, {}), WebhookSignatureError);
    const tampered = Buffer.from(event.body.toString().replace('mock_cs_1', 'mock_cs_2'));
    assert.throws(() => gateway.parseWebhook(tampered, event.headers), WebhookSignatureError);
    const other = createMockGateway({ secret: 'un-altre-secret' }).buildEvent({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok });
    assert.throws(() => gateway.parseWebhook(other.body, other.headers), WebhookSignatureError);
    assert.throws(() => gateway.parseWebhook(event.body, { [MOCK_SIGNATURE_HEADER]: 'abc' }), WebhookSignatureError);
  });

  it('només accepta targetes de prova i la 0341 rebutja la retenció de la fiança', async () => {
    assert.throws(() => gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: '5555 5555 5555 4444' }), PaymentDeclinedError);
    assert.match((await gateway.holdDeposit({ customerRef: 'mock_cus_4242' })).ref, /^mock_hold_/);
    await assert.rejects(gateway.holdDeposit({ customerRef: 'mock_cus_0341' }), PaymentDeclinedError);
  });
});

describe('passarel·la de Stripe (client simulat, signatura real)', () => {
  const SECRET = 'whsec_test_secret';
  const calls = [];
  const record = (name, result) => async (...args) => {
    calls.push([name, ...args]);
    if (result instanceof Error) throw result;
    return typeof result === 'function' ? result(...args) : result;
  };
  const cardError = Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError' });
  const client = (overrides = {}) => ({
    // La verificació de la signatura és la de la llibreria de Stripe, no una imitació.
    webhooks: new Stripe('sk_test_x').webhooks,
    checkout: { sessions: { create: record('sessions.create', { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), expire: record('sessions.expire', {}) } },
    paymentIntents: {
      retrieve: record('pi.retrieve', { id: 'pi_paid', payment_method: 'pm_card' }),
      create: record('pi.create', overrides.hold ?? { id: 'pi_hold', status: 'requires_capture' }),
      cancel: record('pi.cancel', {}),
    },
    refunds: { create: record('refunds.create', {}) },
  });
  const gateway = (overrides) => createStripeGateway({ secretKey: 'sk_test_x', webhookSecret: SECRET, client: client(overrides), now: () => 1_900_000_000_000 });
  const signed = (event, secret = SECRET) => {
    const payload = JSON.stringify(event);
    const header = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload, secret });
    return [Buffer.from(payload), { 'stripe-signature': header }];
  };
  const sessionEvent = (type, session = {}) => ({
    id: 'evt_1', object: 'event', type,
    data: { object: { id: 'cs_test_1', object: 'checkout.session', payment_status: 'paid', payment_intent: 'pi_paid', customer: 'cus_1', ...session } },
  });

  it('crea una sessió de Checkout allotjada amb l\'import en cèntims i sense fixar mètodes de pagament', async () => {
    calls.length = 0;
    const checkout = await gateway().createCheckout({
      paymentId: 'pay-1', bookingNumber: 'B4-2030-000007', amountMinor: 20500, currency: 'EUR', customerEmail: 'cliente@example.com',
      successUrl: 'https://app/ok', cancelUrl: 'https://app/cancel',
    });
    assert.deepEqual(checkout, { ref: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const [, params, options] = calls[0];
    assert.equal(params.mode, 'payment');
    assert.deepEqual(params.line_items[0].price_data, { currency: 'eur', unit_amount: 20500, product_data: { name: 'Reserva B4-2030-000007 · Bloop4' } });
    assert.equal(params.payment_intent_data.setup_future_usage, 'off_session');
    assert.equal(params.payment_method_types, undefined);
    assert.equal(params.expires_at, 1_900_000_000 + 30 * 60);
    assert.deepEqual(options, { idempotencyKey: 'checkout-pay-1' });
  });

  it('checkout.session.completed pagada → checkout.succeeded amb el cobrament i el client', () => {
    assert.deepEqual(gateway().parseWebhook(...signed(sessionEvent('checkout.session.completed'))), {
      id: 'evt_1', ref: 'cs_test_1', chargeRef: 'pi_paid', customerRef: 'cus_1', reason: null, type: 'checkout.succeeded',
    });
  });

  it('una sessió completada però encara sense cobrar no confirma res; expirada i fallida es tradueixen', () => {
    const g = gateway();
    assert.equal(g.parseWebhook(...signed(sessionEvent('checkout.session.completed', { payment_status: 'unpaid' }))), null);
    assert.equal(g.parseWebhook(...signed(sessionEvent('checkout.session.async_payment_succeeded'))).type, 'checkout.succeeded');
    assert.equal(g.parseWebhook(...signed(sessionEvent('checkout.session.expired'))).type, 'checkout.expired');
    assert.equal(g.parseWebhook(...signed(sessionEvent('checkout.session.async_payment_failed'))).type, 'checkout.failed');
    assert.equal(g.parseWebhook(...signed(sessionEvent('customer.created'))), null);
  });

  it('rebutja un avís sense Stripe-Signature, amb un altre secret o amb el cos manipulat', () => {
    const g = gateway();
    const [body, headers] = signed(sessionEvent('checkout.session.completed'));
    assert.throws(() => g.parseWebhook(body, {}), WebhookSignatureError);
    assert.throws(() => g.parseWebhook(...signed(sessionEvent('checkout.session.completed'), 'whsec_un_altre')), WebhookSignatureError);
    assert.throws(() => g.parseWebhook(Buffer.from(body.toString().replace('cs_test_1', 'cs_test_2')), headers), WebhookSignatureError);
  });

  it('la fiança és una autorització amb captura manual sobre la targeta del pagament', async () => {
    calls.length = 0;
    const { ref } = await gateway().holdDeposit({ eventId: 'e1', bookingNumber: 'B4-2030-000007', amountMinor: 30000, currency: 'EUR', customerRef: 'cus_1', chargeRef: 'pi_paid' });
    assert.equal(ref, 'pi_hold');
    const [, params] = calls.find(([name]) => name === 'pi.create');
    assert.equal(params.capture_method, 'manual');
    assert.deepEqual([params.amount, params.currency, params.customer, params.payment_method, params.off_session, params.confirm], [30000, 'eur', 'cus_1', 'pm_card', true, true]);
    assert.equal(params.payment_method_types, undefined);
  });

  it('si la targeta rebutja la retenció (o demana verificació) llança PaymentDeclinedError', async () => {
    const args = { eventId: 'e1', bookingNumber: 'B4', amountMinor: 30000, currency: 'EUR', customerRef: 'cus_1', chargeRef: 'pi_paid' };
    await assert.rejects(gateway({ hold: cardError }).holdDeposit(args), PaymentDeclinedError);
    await assert.rejects(gateway({ hold: { id: 'pi_hold', status: 'requires_action' } }).holdDeposit(args), PaymentDeclinedError);
    await assert.rejects(gateway({ hold: new Error('xarxa') }).holdDeposit(args), /xarxa/);
  });

  it('alliberar la fiança cancel·la l\'autorització; retornar un pagament crea un reemborsament', async () => {
    calls.length = 0;
    const g = gateway();
    await g.releaseDeposit('pi_hold');
    await g.refund('pi_paid');
    await g.expireCheckout('cs_test_1');
    assert.deepEqual(calls.map(([name, arg]) => [name, arg]), [['pi.cancel', 'pi_hold'], ['refunds.create', { payment_intent: 'pi_paid' }], ['sessions.expire', 'cs_test_1']]);
  });
});
