import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { conflictError } from '../src/errors.js';

const BOOKING = 'f0000000-0000-4000-8000-0000000000aa';
const SERVICE = 'd1000000-0000-4000-8000-000000000001';
const USERS = {
  client: { id: 'u1', status: 'active', roles: ['customer'] },
  other: { id: 'u2', status: 'active', roles: ['customer'] },
  rider: { id: 'r1', status: 'active', roles: ['rider'] },
};
const state = {};
const bookingRepository = {
  async findBooking(id) { return id === BOOKING ? { id, customerId: 'u1', bookingNumber: 'B4-2030-000001', status: 'confirmed' } : null; },
};
const trackingRepository = {
  async tracking() { return [{ seller: { id: 's1' }, phase: 'delivery_in_transit', delivery: { status: 'in_transit' }, pickup: null }]; },
  async start(id, riderId) { state.started.push([id, riderId]); if (state.startError) throw state.startError; },
  async serviceContext() { return { customerId: 'u1', bookingId: BOOKING, type: 'delivery', status: 'in_transit', sellerLegalName: 'Sonido Levante S.L.' }; },
};
const notificationRepository = {
  async create(userId, n) { state.created.push([userId, n.title]); },
  async list(userId) { return { notifications: [{ id: 'n1', title: 'Hola' }], unreadCount: userId === 'u1' ? 1 : 0 }; },
  async markRead(id, userId) { return userId === 'u1'; },
  async markAllRead(userId) { state.readAll = userId; },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, logger: { error() {} },
    bookingRepository, trackingRepository, notificationRepository,
    riderRepository: { async findRider() { return { userId: 'r1', vehicleType: 'van' }; }, async findMine(id) { return { id, status: 'in_transit' }; } },
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { started: [], created: [], readAll: null, startError: null }));

async function call(method, path, { as = 'client', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
}

describe('GET /api/bookings/:id/tracking', () => {
  it('el client veu el seguiment de la seva reserva, sense memòria cau', async () => {
    const { status, headers, body } = await call('GET', `/bookings/${BOOKING}/tracking`);
    assert.equal(status, 200);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(body.data.sellers[0].phase, 'delivery_in_transit');
    assert.ok(body.data.checkedAt);
  });

  it('la reserva d\'un altre client 403; sense sessió 401', async () => {
    assert.equal((await call('GET', `/bookings/${BOOKING}/tracking`, { as: 'other' })).status, 403);
    assert.equal((await call('GET', `/bookings/${BOOKING}/tracking`, { as: null })).status, 401);
  });
});

describe('POST /api/rider/services/:id/start', () => {
  it('inicia el servei i avisa el client', async () => {
    const { status, body } = await call('POST', `/rider/services/${SERVICE}/start`, { as: 'rider' });
    assert.equal(status, 200);
    assert.equal(body.data.status, 'in_transit');
    assert.deepEqual(state.started, [[SERVICE, 'r1']]);
    assert.deepEqual(state.created, [['u1', 'Tu entrega está en camino']]);
  });

  it('una transició no permesa respon 409 i no avisa ningú; un client no pot iniciar serveis', async () => {
    state.startError = conflictError('Este servicio ya no está en el estado esperado', { reason: 'INVALID_TRANSITION' });
    assert.equal((await call('POST', `/rider/services/${SERVICE}/start`, { as: 'rider' })).status, 409);
    assert.deepEqual(state.created, []);
    assert.equal((await call('POST', `/rider/services/${SERVICE}/start`)).status, 403);
  });
});

describe('/api/notifications', () => {
  it('llista els avisos amb el recompte de no llegits i els marca com a llegits', async () => {
    const { body } = await call('GET', '/notifications');
    assert.deepEqual([body.data.length, body.unreadCount], [1, 1]);
    assert.equal((await call('POST', '/notifications/f0000000-0000-4000-8000-000000000001/read')).status, 204);
    assert.equal((await call('POST', '/notifications/f0000000-0000-4000-8000-000000000001/read', { as: 'other' })).status, 404);
    assert.equal((await call('POST', '/notifications/abc/read')).status, 400);
    assert.equal((await call('POST', '/notifications/read-all')).status, 204);
    assert.equal(state.readAll, 'u1');
    assert.equal((await call('GET', '/notifications', { as: null })).status, 401);
  });
});
