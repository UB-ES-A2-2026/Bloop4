import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';

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
const locationRepository = {
  async record(id, riderId, position) { state.recorded.push(position); },
  async activeDeliveries() { return [{ serviceId: 'x', location: { latitude: 39.47, longitude: -0.37 } }]; },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, logger: { error() {} },
    bookingRepository, locationRepository,
    riderRepository: { async findRider() { return { userId: 'r1', vehicleType: 'van' }; } },
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { recorded: [] }));

async function call(method, path, { as = 'client', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
}

describe('ubicació del rider (US-16)', () => {
  it('valida i arrodoneix les coordenades que envia el rider', async () => {
    const ok = await call('POST', `/rider/services/${SERVICE}/location`, { as: 'rider', body: { latitude: 39.46990712345, longitude: -0.37628, accuracy: 8 } });
    assert.equal(ok.status, 204);
    assert.deepEqual(state.recorded, [{ latitude: 39.469907, longitude: -0.37628, accuracy: 8 }]);
    for (const body of [{ latitude: 91, longitude: 0 }, { latitude: 39, longitude: -181 }, { latitude: '39', longitude: 0 }, { latitude: 39, longitude: 0, accuracy: -1 }, {}]) {
      assert.equal((await call('POST', `/rider/services/${SERVICE}/location`, { as: 'rider', body })).status, 400, JSON.stringify(body));
    }
    assert.equal((await call('POST', `/rider/services/${SERVICE}/location`, { body: { latitude: 39, longitude: 0 } })).status, 403);
  });

  it('el client consulta les posicions de la seva reserva; un altre client, no', async () => {
    const { status, headers, body } = await call('GET', `/bookings/${BOOKING}/locations`);
    assert.equal(status, 200);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(body.data[0].location.latitude, 39.47);
    assert.equal((await call('GET', `/bookings/${BOOKING}/locations`, { as: 'other' })).status, 403);
    assert.equal((await call('GET', `/bookings/${BOOKING}/locations`, { as: null })).status, 401);
  });
});
