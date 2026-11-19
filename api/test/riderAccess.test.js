import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { parseServiceId } from '../src/routes/riderAccess.js';

const SERVICE = 'd1000000-0000-4000-8000-000000000001';
const USERS = {
  rider: { id: 'r1', status: 'active', roles: ['rider'] },
  incomplete: { id: 'r2', status: 'active', roles: ['rider'] },
  customer: { id: 'u1', status: 'active', roles: ['customer'] },
  admin: { id: 'a1', status: 'active', roles: ['admin'] },
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
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, riderRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, { as = 'rider', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

describe('/api/rider (fonaments)', () => {
  it('només els riders amb vehicle: 401 sense sessió, 403 un client o un rider sense perfil', async () => {
    assert.equal((await call('GET', '/rider/services/x', { as: null })).status, 401);
    assert.equal((await call('GET', '/rider/services/x', { as: 'customer' })).status, 403);
    const incomplete = await call('GET', '/rider/services/x', { as: 'incomplete' });
    assert.equal(incomplete.status, 403);
    assert.match(incomplete.body.error.message, /falta el vehículo/);
  });


  it('un rider amb vehicle passa: una ruta que cap història no ha muntat no existeix (404)', async () => {
    assert.equal((await call('POST', `/rider/services/${SERVICE}/accept`)).status, 404);
  });

  it('el detall d\'un servei seu; el d\'un altre rider (o inexistent) respon 404 i un id invàlid, 400', async () => {
    assert.equal((await call('GET', `/rider/services/${SERVICE}`)).body.data.status, 'assigned');
    assert.equal((await call('GET', '/rider/services/d1000000-0000-4000-8000-000000000099')).status, 404);
    assert.equal((await call('GET', '/rider/services/x')).status, 400);
    assert.equal((await call('GET', `/rider/services/${SERVICE}`, { as: 'customer' })).status, 403);
  });
});

describe('parseServiceId', () => {
  it('accepta un UUID (en minúscules) i rebutja la resta amb 400', () => {
    assert.equal(parseServiceId('D1000000-0000-4000-8000-000000000001'), 'd1000000-0000-4000-8000-000000000001');
    for (const raw of ['123', '', undefined, 42]) {
      assert.throws(() => parseServiceId(raw), (err) => err.status === 400 && err.details.field === 'id');
    }
  });
});
