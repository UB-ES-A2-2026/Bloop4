import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { conflictError } from '../src/errors.js';

const SERVICE = 'd1000000-0000-4000-8000-000000000001';
const USERS = {
  rider: { id: 'r1', status: 'active', roles: ['rider'] },
  incomplete: { id: 'r2', status: 'active', roles: ['rider'] },
  customer: { id: 'u1', status: 'active', roles: ['customer'] },
  admin: { id: 'a1', status: 'active', roles: ['admin'] },
};
const state = {};
const acceptanceRepository = {
  async availableServices(rider) { state.listedFor = rider; return [{ id: SERVICE, type: 'delivery', zone: { postalCode: '46001', city: 'Valencia' } }]; },
  async accept(id, rider) {
    state.accepted.push([id, rider.userId]);
    if (state.taken) throw conflictError('Este servicio ya no está disponible: otro repartidor lo ha aceptado', { reason: 'TAKEN' });
    return { id, status: 'assigned', address: { street: 'Calle Ficticia 1' } };
  },
  async createRider(email, vehicleType) { state.created.push([email, vehicleType]); return { userId: 'u9', email, vehicleType }; },
};
// Fonaments: el perfil del rider i com veu un servei seu.
const riderRepository = {
  async findRider(userId) { return userId === 'r1' ? { userId: 'r1', vehicleType: 'van' } : null; },
  async findMine(id, riderId) { return id === SERVICE && riderId === 'r1' ? { id, status: 'assigned' } : null; },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, riderRepository, acceptanceRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { accepted: [], created: [], taken: false, listedFor: null }));

async function call(method, path, { as = 'rider', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

describe('serveis disponibles i acceptació (US-14)', () => {
  it('només els riders amb vehicle', async () => {
    assert.equal((await call('GET', '/rider/services/available', { as: 'customer' })).status, 403);
    assert.equal((await call('GET', '/rider/services/available', { as: 'incomplete' })).status, 403);
  });

  it('llista els serveis disponibles amb el vehicle del rider', async () => {
    const { status, body } = await call('GET', '/rider/services/available');
    assert.equal(status, 200);
    assert.equal(body.data[0].id, SERVICE);
    assert.deepEqual(state.listedFor, { userId: 'r1', vehicleType: 'van' });
  });

  it('accepta un servei; si un altre s\'ha avançat, 409; id invàlid, 400', async () => {
    assert.equal((await call('POST', `/rider/services/${SERVICE}/accept`)).body.data.status, 'assigned');
    assert.deepEqual(state.accepted, [[SERVICE, 'r1']]);
    state.taken = true;
    const taken = await call('POST', `/rider/services/${SERVICE}/accept`);
    assert.deepEqual([taken.status, taken.body.error.details.reason], [409, 'TAKEN']);
    assert.equal((await call('POST', '/rider/services/123/accept')).status, 400);
  });
});

describe('POST /api/admin/riders', () => {
  it('només un administrador; normalitza el correu i exigeix el vehicle', async () => {
    assert.equal((await call('POST', '/admin/riders', { as: 'rider', body: { email: 'x@example.com', vehicleType: 'car' } })).status, 403);
    assert.equal((await call('POST', '/admin/riders', { as: 'admin', body: { email: 'x@example.com' } })).status, 400);
    const { status } = await call('POST', '/admin/riders', { as: 'admin', body: { email: ' Nou@Example.com ', vehicleType: 'car' } });
    assert.equal(status, 201);
    assert.deepEqual(state.created, [['nou@example.com', 'car']]);
  });
});
