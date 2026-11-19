import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { createHooks } from '../src/hooks.js';

const BOOKING = 'f0000000-0000-4000-8000-0000000000aa';
const USERS = {
  client: { id: 'u1', status: 'active', roles: ['customer'] },
  other: { id: 'u2', status: 'active', roles: ['customer'] },
  pending: { id: 'u3', status: 'pending_verification', roles: ['customer'] },
  seller: { id: 'u4', status: 'active', roles: ['seller'] },
};

const state = {};
const booking = (overrides = {}) => ({
  id: BOOKING, customerId: 'u1', bookingNumber: 'B4-2030-000007', status: 'confirmed',
  holdExpiresAt: null, confirmedAt: new Date('2030-01-01T10:20:00Z'), startsAt: new Date('2030-07-04T08:00:00Z'),
  endsAt: new Date('2030-07-05T09:00:00Z'), createdAt: new Date('2030-01-01T10:00:00Z'), ...overrides,
});
const bookingRepository = {
  async findBooking(id) { return id === BOOKING ? booking() : null; },
  async listBookings(customerId) { return customerId === 'u1' ? [booking()] : []; },
};
const cartRepository = {
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
hooks.on('beforeBookingRead', (customerId) => state.reads.push(customerId));

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, hooks,
    cartRepository, deliveryRepository, bookingRepository, logger: { error() {} },
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { reads: [], deliveryReads: [] }));

async function call(method, path, { as = 'client' } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  const res = await fetch(base + path, { method, headers });
  return { status: res.status, body: await res.json() };
}

describe('GET /api/bookings (fonaments)', () => {
  it('llista les reserves del client sense l\'id del client, després de fer saber que s\'hi accedeix', async () => {
    const { status, body } = await call('GET', '/bookings');
    assert.equal(status, 200);
    assert.deepEqual(body.data.map((b) => [b.bookingNumber, b.status, b.customerId]), [['B4-2030-000007', 'confirmed', undefined]]);
    assert.deepEqual(state.reads, ['u1']);
    assert.equal((await call('GET', '/bookings', { as: 'seller' })).status, 403);
    assert.equal((await call('GET', '/bookings', { as: null })).status, 401);
  });
});

describe('GET /api/bookings/:id (fonaments)', () => {
  it('retorna la reserva amb el resum i els imports congelats (el transport no es recalcula)', async () => {
    const { status, body } = await call('GET', `/bookings/${BOOKING}`);
    assert.equal(status, 200);
    assert.deepEqual(body.data.totals, { rental: '180.00', deposit: '300.00', transport: '25.00', toPay: '205.00' });
    assert.deepEqual([body.data.billableDays, body.data.currency, body.data.customerId], [2, 'EUR', undefined]);
    assert.deepEqual(state.deliveryReads, [{ recalculate: false }]);
  });

  it('la reserva d\'un altre client 403; inexistent 404; id invàlid 400', async () => {
    assert.equal((await call('GET', `/bookings/${BOOKING}`, { as: 'other' })).status, 403);
    assert.equal((await call('GET', '/bookings/f0000000-0000-4000-8000-0000000000bb')).status, 404);
    assert.equal((await call('GET', '/bookings/123')).status, 400);
  });
});
