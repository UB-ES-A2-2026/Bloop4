import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { createMockGateway, MOCK_CARDS } from '../src/payments/mockGateway.js';

const BOOKING = 'f0000000-0000-4000-8000-0000000000aa';
const USERS = {
  client: { id: 'u1', email: 'cliente@example.com', status: 'active', roles: ['customer'] },
  other: { id: 'u2', status: 'active', roles: ['customer'] },
  pending: { id: 'u3', status: 'pending_verification', roles: ['customer'] },
  seller: { id: 'u4', status: 'active', roles: ['seller'] },
};
const gateway = createMockGateway({ secret: 'secret-de-prova' });
const state = {};
const paymentService = {
  async start(booking, user) { state.started.push([booking.id, user.email]); return { status: 'pending', amount: '205.00', currency: 'EUR', checkoutUrl: 'http://pay.test/1', id: 'intern' }; },
  async status() { return { status: 'succeeded', receiptNumber: 'R-2030-000001', deposit: null }; },
  async handleWebhook(body, headers) { state.webhooks.push(gateway.parseWebhook(body, headers)); return 'processed'; },
};
const bookingRepository = {
  async findBooking(id) { return id === BOOKING ? { id: BOOKING, customerId: 'u1', status: 'pending_payment' } : null; },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
function start(paymentGateway) {
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, bookingRepository, paymentService, paymentGateway, logger: { error() {} } });
  const s = app.listen(0);
  return new Promise((resolve) => s.once('listening', () => resolve(s)));
}
before(async () => {
  server = await start(gateway);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { started: [], webhooks: [] }));

async function call(method, path, { as = 'client', body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (as) h.Cookie = `bloop4_session=${as}`;
  if (body) h['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers: h, body: raw ?? (body && JSON.stringify(body)) });
  return { status: res.status, body: await res.json() };
}

describe('POST i GET /api/bookings/:id/payment', () => {
  it('inicia el pagament i retorna la pàgina on pagar, sense dades internes', async () => {
    const { status, body } = await call('POST', `/bookings/${BOOKING}/payment`);
    assert.equal(status, 201);
    assert.deepEqual(body.data, { status: 'pending', amount: '205.00', currency: 'EUR', checkoutUrl: 'http://pay.test/1' });
    assert.deepEqual(state.started, [[BOOKING, 'cliente@example.com']]);
  });

  it('només el client de la reserva: 401 sense sessió, 403 un altre client, un venedor o un compte sense verificar', async () => {
    assert.equal((await call('POST', `/bookings/${BOOKING}/payment`, { as: null })).status, 401);
    for (const as of ['other', 'seller', 'pending']) {
      assert.equal((await call('POST', `/bookings/${BOOKING}/payment`, { as })).status, 403, as);
    }
    assert.equal((await call('GET', `/bookings/${BOOKING}/payment`, { as: 'other' })).status, 403);
    assert.equal((await call('GET', '/bookings/f0000000-0000-4000-8000-0000000000bb/payment')).status, 404);
    assert.deepEqual(state.started, []);
  });

  it('en tornar a la pàgina es pot consultar l\'estat del pagament', async () => {
    const { body } = await call('GET', `/bookings/${BOOKING}/payment`);
    assert.equal(body.data.receiptNumber, 'R-2030-000001');
  });
});

describe('POST /api/payments/webhook', () => {
  it('no necessita sessió: l\'autentica la signatura sobre el cos tal com arriba', async () => {
    const event = gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok });
    const { status, body } = await call('POST', '/payments/webhook', { as: null, raw: event.body, headers: { ...event.headers, 'Content-Type': 'application/json' } });
    assert.equal(status, 200);
    assert.deepEqual(body, { received: true, outcome: 'processed' });
    assert.equal(state.webhooks[0].ref, 'mock_cs_1');
  });

  it('sense signatura o amb el cos manipulat respon 400 i no processa res', async () => {
    const event = gateway.buildEvent({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok });
    const unsigned = await call('POST', '/payments/webhook', { as: null, raw: event.body });
    assert.deepEqual([unsigned.status, unsigned.body.error.code], [400, 'INVALID_SIGNATURE']);
    const tampered = await call('POST', '/payments/webhook', { as: null, raw: event.body.toString().replace('mock_cs_1', 'mock_cs_9'), headers: event.headers });
    assert.equal(tampered.status, 400);
    assert.deepEqual(state.webhooks, []);
  });
});

describe('POST /api/payments/mock/complete', () => {
  it('signa al servidor l\'avís de la targeta de prova i diu si ha pagat o s\'ha rebutjat', async () => {
    const ok = await call('POST', '/payments/mock/complete', { body: { ref: 'mock_cs_1', cardNumber: '4242 4242 4242 4242' } });
    assert.deepEqual(ok.body.data, { result: 'succeeded' });
    const declined = await call('POST', '/payments/mock/complete', { body: { ref: 'mock_cs_1', cardNumber: MOCK_CARDS.declined } });
    assert.deepEqual(declined.body.data, { result: 'failed' });
    assert.deepEqual(state.webhooks.map((w) => w.type), ['checkout.succeeded', 'checkout.failed']);
  });

  it('rebutja targetes que no són de prova, referències invàlides i peticions sense sessió', async () => {
    assert.equal((await call('POST', '/payments/mock/complete', { body: { ref: 'mock_cs_1', cardNumber: '5555555555554444' } })).status, 400);
    assert.equal((await call('POST', '/payments/mock/complete', { body: { ref: 'cs_live_1', cardNumber: MOCK_CARDS.ok } })).status, 400);
    assert.equal((await call('POST', '/payments/mock/complete', { as: null, body: { ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok } })).status, 401);
    assert.deepEqual(state.webhooks, []);
  });

  it('amb PAYMENT_PROVIDER=stripe la ruta de pagament simulat no existeix', async () => {
    const stripeLike = await start({ name: 'stripe' });
    try {
      const res = await fetch(`http://127.0.0.1:${stripeLike.address().port}/api/payments/mock/complete`, {
        method: 'POST', headers: { Cookie: 'bloop4_session=client', 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'mock_cs_1', cardNumber: MOCK_CARDS.ok }),
      });
      assert.equal(res.status, 404);
    } finally {
      stripeLike.close();
    }
  });
});
