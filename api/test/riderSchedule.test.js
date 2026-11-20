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

describe('serveis assignats (US-15)', () => {
  it('la llista d\'un dia valida la data; sense data, els propers', async () => {
    assert.equal((await call('GET', '/rider/services?date=2030-06-15')).body.data[0].id, SERVICE);
    assert.deepEqual(state.day, ['r1', '2030-06-15']);
    for (const date of ['15-06-2030', '2030-6-1', 'avui']) {
      assert.equal((await call('GET', `/rider/services?date=${date}`)).status, 400, date);
    }
    assert.equal((await call('GET', '/rider/services')).status, 200);
    assert.equal(state.upcomingFor, 'r1');
  });
});

