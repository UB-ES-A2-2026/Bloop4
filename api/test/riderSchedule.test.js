import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';

const SERVICE = 'd1000000-0000-4000-8000-000000000001';
const USERS = {
  rider: { id: 'r1', status: 'active', roles: ['rider'] },
  incomplete: { id: 'r2', status: 'active', roles: ['rider'] },
  customer: { id: 'u1', status: 'active', roles: ['customer'] },
  admin: { id: 'a1', status: 'active', roles: ['admin'] },
};
const state = {};
const riderScheduleRepository = {
  async servicesOn(riderId, date) { state.day = [riderId, date]; return [{ id: SERVICE }]; },
  async upcoming(riderId) { state.upcomingFor = riderId; return []; },
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
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, riderRepository, riderScheduleRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { day: null, upcomingFor: null }));

async function call(method, path, { as = 'rider', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

describe('US-15 · serveis assignats', () => {
  it('només els riders amb vehicle: 401 sense sessió, 403 un client, un administrador o un rider sense perfil', async () => {
    assert.equal((await call('GET', '/rider/services', { as: null })).status, 401);
    assert.equal((await call('GET', '/rider/services?date=2030-06-15', { as: null })).status, 401);
    for (const as of ['customer', 'admin', 'incomplete']) {
      assert.equal((await call('GET', '/rider/services?date=2030-06-15', { as })).status, 403, as);
    }
    assert.deepEqual([state.day, state.upcomingFor], [null, null]);
  });

  it('la llista d\'un dia valida la data; sense data, els propers', async () => {
    assert.equal((await call('GET', '/rider/services?date=2030-06-15')).body.data[0].id, SERVICE);
    assert.deepEqual(state.day, ['r1', '2030-06-15']);
    for (const date of ['15-06-2030', '2030-6-1', 'avui']) {
      assert.equal((await call('GET', `/rider/services?date=${date}`)).status, 400, date);
    }
    assert.equal((await call('GET', '/rider/services')).status, 200);
    assert.equal(state.upcomingFor, 'r1');
  });

  it('valors límit de la data: el primer i l\'últim dia de cada mes, i el dia següent', async () => {
    for (const date of ['2030-01-01', '2030-01-31', '2030-02-28', '2028-02-29', '2030-04-30', '2030-12-31', '0001-01-01']) {
      const res = await call('GET', `/rider/services?date=${date}`);
      assert.equal(res.status, 200, date);
      assert.deepEqual(state.day, ['r1', date]);
    }
    state.day = null;
    for (const date of ['2030-01-00', '2030-01-32', '2030-02-29', '2030-02-31', '2030-04-31', '2030-00-15', '2030-13-01', '0000-01-01']) {
      const res = await call('GET', `/rider/services?date=${date}`);
      assert.equal(res.status, 400, date);
      assert.equal(res.body.error.details.field, 'date');
    }
    assert.equal((await call('GET', '/rider/services?date=')).status, 400);
    assert.equal((await call('GET', '/rider/services?date=2030-06-15&date=2030-06-16')).status, 400);
    assert.equal(state.day, null);
  });
});
