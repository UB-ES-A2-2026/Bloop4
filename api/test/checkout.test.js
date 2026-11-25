import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { ApiError } from '../src/errors.js';
import { notifySellers } from '../src/bookings/sellerNotice.js';
import { createHooks } from '../src/hooks.js';

const BOOKING = 'f0000000-0000-4000-8000-0000000000aa';
const KEY = 'clau-de-prova-0001';
const USERS = {
  client: { id: 'u1', status: 'active', roles: ['customer'] },
  other: { id: 'u2', status: 'active', roles: ['customer'] },
  pending: { id: 'u3', status: 'pending_verification', roles: ['customer'] },
  seller: { id: 'u4', status: 'active', roles: ['seller'] },
};

const state = {};
const booking = (overrides = {}) => ({
  id: BOOKING, customerId: 'u1', bookingNumber: 'B4-2030-000007', status: 'pending_payment',
  holdExpiresAt: new Date('2030-01-01T10:15:00Z'), confirmedAt: null, startsAt: new Date('2030-07-04T08:00:00Z'),
  endsAt: new Date('2030-07-05T09:00:00Z'), createdAt: new Date('2030-01-01T10:00:00Z'), ...overrides,
});
const bookingRepository = {
  async findBooking(id) { return id === BOOKING ? state.booking : null; },
  async listBookings(customerId) { return customerId === 'u1' ? [booking()] : []; },
};
const checkoutRepository = {
  async checkout(customerId, options) {
    state.checkouts.push({ customerId, ...options });
    if (state.checkoutError) throw state.checkoutError;
    return { id: BOOKING, created: state.created };
  },
  async releaseExpiredHolds(customerId) { state.released.push(customerId); return 0; },
  async cancelHold(id) { state.cancelled.push(id); return state.cancellable; },
};
const cartRepository = {
  async findDraft() { return state.draft; },
  async expireStale() {},
  async getCart() {
    return { id: BOOKING, billableDays: 2, currency: 'EUR', sellers: [{ seller: { id: 's1' }, items: [] }], totals: { rental: '180.00', deposit: '300.00', toPay: '180.00' } };
  },
};
const deliveryRepository = {
  async getDelivery(eventId, options) { state.deliveryReads.push(options ?? {}); return { transportTotal: '25.00' }; },
  async addAmounts(a, b) { return (Number(a) + Number(b)).toFixed(2); },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

const hooks = createHooks();
const mailer = { async sendNewBookingEmail(mail) { state.mails.push(mail); } };

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer, hooks,
    cartRepository, deliveryRepository, bookingRepository, checkoutRepository, availabilityRepository: { async check() { return { availableUnits: 9 }; } },
    logger: { error() {} },
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, {
  draft: { id: BOOKING }, booking: booking(), created: true, checkoutError: null, cancellable: true,
  checkouts: [], released: [], cancelled: [], deliveryReads: [], mails: [],
}));

async function call(method, path, { as = 'client', key } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(base + path, { method, headers });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

describe('POST /api/cart/checkout', () => {
  it('sense sessió 401; un venedor 403; un compte sense verificar 403', async () => {
    assert.equal((await call('POST', '/cart/checkout', { as: null, key: KEY })).status, 401);
    assert.equal((await call('POST', '/cart/checkout', { as: 'seller', key: KEY })).status, 403);
    assert.equal((await call('POST', '/cart/checkout', { as: 'pending', key: KEY })).status, 403);
    assert.deepEqual(state.checkouts, []);
  });

  it('sense Idempotency-Key, o amb una clau massa curta o amb símbols, 400', async () => {
    for (const key of [undefined, 'curta', 'amb espais i símbols!']) {
      const { status, body } = await call('POST', '/cart/checkout', { key });
      assert.equal(status, 400, String(key));
      assert.equal(body.error.details.field, 'Idempotency-Key');
    }
    assert.deepEqual(state.checkouts, []);
  });

  it('crea la reserva (201) amb el transport congelat i el total a pagar', async () => {
    const { status, body } = await call('POST', '/cart/checkout', { key: KEY });
    assert.equal(status, 201);
    assert.deepEqual(state.checkouts, [{ customerId: 'u1', idempotencyKey: KEY }]);
    assert.equal(body.data.bookingNumber, 'B4-2030-000007');
    assert.equal(body.data.status, 'pending_payment');
    assert.deepEqual(body.data.totals, { rental: '180.00', deposit: '300.00', transport: '25.00', toPay: '205.00' });
    assert.equal(body.data.customerId, undefined);
    // Abans del checkout el transport es recalcula; un cop feta la reserva, ja no.
    assert.deepEqual(state.deliveryReads, [{}, { recalculate: false }]);
  });

  it('una petició repetida amb la mateixa clau respon 200 amb la mateixa reserva', async () => {
    state.created = false;
    const { status, body } = await call('POST', '/cart/checkout', { key: KEY });
    assert.equal(status, 200);
    assert.equal(body.data.id, BOOKING);
  });

  it('si un producte ja no està disponible respon 409 i diu quin', async () => {
    state.checkoutError = new ApiError(409, 'CONFLICT', '«Carpa jaima» ya no está disponible en las fechas del evento', {
      reason: 'UNAVAILABLE', productName: 'Carpa jaima', availableUnits: 0,
    });
    const { status, body } = await call('POST', '/cart/checkout', { key: KEY });
    assert.equal(status, 409);
    assert.equal(body.error.details.reason, 'UNAVAILABLE');
    assert.match(body.error.message, /Carpa jaima.*ya no está disponible/);
  });
});

describe('bloquejos caducats en llegir les reserves (US-12)', () => {
  it('abans de llistar o llegir les reserves del client, se n\'alliberen els bloquejos caducats', async () => {
    assert.equal((await call('GET', '/bookings')).status, 200);
    assert.equal((await call('GET', `/bookings/${BOOKING}`, { as: 'other' })).status, 403);
    assert.deepEqual(state.released, ['u1', 'u2']);
  });
});

describe('POST /api/bookings/:id/cancel', () => {
  it('allibera una reserva pendent (204); si ja no ho està, 409; la d\'un altre, 403', async () => {
    assert.equal((await call('POST', `/bookings/${BOOKING}/cancel`)).status, 204);
    assert.deepEqual(state.cancelled, [BOOKING]);
    state.cancellable = false;
    assert.equal((await call('POST', `/bookings/${BOOKING}/cancel`)).status, 409);
    assert.equal((await call('POST', `/bookings/${BOOKING}/cancel`, { as: 'other' })).status, 403);
  });
});

describe('avís als venedors d\'una reserva confirmada', () => {
  const sellers = [
    { legalName: 'Sonido Levante S.L.', email: 'sonido@example.com' },
    { legalName: 'Sin cuenta S.L.', email: null },
    { legalName: 'Mobiliario Turia S.L.', email: 'mobiliario@example.com' },
  ];

  it('avisa cada venedor amb compte; un correu que falla no desfà la confirmació', async () => {
    const sent = [];
    const errors = [];
    const onConfirmed = notifySellers({
      mailer: {
        async sendNewBookingEmail(mail) {
          if (mail.to.startsWith('sonido')) throw new Error('SMTP caigut');
          sent.push(mail);
        },
      },
      logger: { error: (meta, message) => errors.push(message) },
    });
    await onConfirmed({ booking: booking({ status: 'confirmed' }), sellers });
    assert.deepEqual(sent.map((m) => [m.to, m.bookingNumber]), [['mobiliario@example.com', 'B4-2030-000007']]);
    // El correu no surt sencer al log.
    assert.deepEqual(errors, ['No se pudo avisar de la reserva a s***@example.com']);
  });

  it('quan una reserva es confirma (bookingConfirmed), l\'app avisa els venedors', async () => {
    await hooks.emit('bookingConfirmed', { booking: booking({ status: 'confirmed' }), sellers: sellers.slice(0, 1) });
    assert.deepEqual(state.mails.map((m) => [m.to, m.sellerName]), [['sonido@example.com', 'Sonido Levante S.L.']]);
  });
});
