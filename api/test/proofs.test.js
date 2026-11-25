import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { conflictError } from '../src/errors.js';

const SERVICE = 'd1000000-0000-4000-8000-000000000001';
const ITEM = 'f1000000-0000-4000-8000-000000000001';
const PHOTO = 'e1000000-0000-4000-8000-000000000001';
const USERS = {
  rider: { id: 'r1', status: 'active', roles: ['rider'] },
  customer: { id: 'u1', status: 'active', roles: ['customer'] },
  stranger: { id: 'u2', status: 'active', roles: ['customer'] },
  seller: { id: 's1', status: 'active', roles: ['seller'], seller: { id: 'a1' } },
  admin: { id: 'a9', status: 'active', roles: ['admin'] },
};
const state = {};
const proofRepository = {
  async requireInTransit(id) {
    if (state.notInTransit) throw conflictError('Inicia el servicio antes de registrar la prueba', { reason: 'NOT_IN_TRANSIT' });
    return { id, items: [{ id: ITEM, name: 'Altavoz' }] };
  },
  async riderService(id) { return { id }; },
  async addPhoto(photo) { state.photos.push(photo); return { id: PHOTO, eventItemId: photo.eventItemId, url: `/api/proofs/photos/${PHOTO}` }; },
  async photos() { return []; },
  async deletePhoto() { return null; },
  async complete(id, riderId, items) { state.completed = items; return { service: { id, event_id: 'e1' }, problems: [] }; },
  async canView(id, user) { return ['r1', 'u1', 's1'].includes(user.id) || user.roles.includes('admin'); },
  async findPhoto(id) { return id === PHOTO ? { path: 'x/y.jpg', contentType: 'image/jpeg', deliveryId: SERVICE } : null; },
  async proof() { return { serviceId: SERVICE, items: [] }; },
  async sellerServices(sellerId) { return [{ id: SERVICE, sellerId }]; },
};
const proofStore = {
  async save(id, buffer, ext) { state.saved.push(ext); return { path: `${id}/p.${ext}`, contentType: 'image/jpeg' }; },
  async read() { return Buffer.from([0xff, 0xd8, 0xff]); },
  async remove(p) { state.removed.push(p); },
};
const incidentRepository = {
  async report(id, riderId, details) { state.reported = details; return { id: 'i1', serviceId: id, status: 'open', description: details.description }; },
  async recipients() { return { adminIds: [], sellerUserId: null, bookingNumber: 'B4', type: 'delivery' }; },
  async settle() { return { completed: false, openIncidents: 0 }; },
  async list() { return [{ id: 'i1' }]; },
  async resolve() { return 'e1'; },
};
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, logger: { error() {} },
    riderRepository: {
      async findRider(id) { return id === 'r1' ? { userId: 'r1', vehicleType: 'van' } : null; },
      async findMine(id) { return { id, status: 'delivered' }; },
    },
    notificationRepository: { async create() {} },
    proofRepository, proofStore, incidentRepository,
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { photos: [], saved: [], removed: [], completed: null, reported: null, notInTransit: false }));

async function call(method, path, { as = 'rider', body, form } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form ?? (body && JSON.stringify(body)) });
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
}
const photoForm = (bytes, eventItemId = ITEM) => {
  const form = new FormData();
  if (eventItemId) form.append('eventItemId', eventItemId);
  form.append('photo', new Blob([Uint8Array.from(bytes)]), 'foto.jpg');
  return form;
};

describe('fotos de la prova', () => {
  it('desa una foto JPEG d\'una línia del servei', async () => {
    const { status, body } = await call('POST', `/rider/services/${SERVICE}/photos`, { form: photoForm([0xff, 0xd8, 0xff, 0xe0]) });
    assert.equal(status, 201);
    assert.equal(body.data.url, `/api/proofs/photos/${PHOTO}`);
    assert.deepEqual(state.saved, ['jpg']);
  });

  it('rebutja un fitxer que no és una imatge, una línia d\'un altre servei i un servei que no està en curs', async () => {
    assert.equal((await call('POST', `/rider/services/${SERVICE}/photos`, { form: photoForm(Buffer.from('<svg>')) })).status, 400);
    assert.equal((await call('POST', `/rider/services/${SERVICE}/photos`, { form: photoForm([0xff, 0xd8, 0xff], 'f1000000-0000-4000-8000-000000000099') })).status, 400);
    state.notInTransit = true;
    assert.equal((await call('POST', `/rider/services/${SERVICE}/photos`, { form: photoForm([0xff, 0xd8, 0xff]) })).status, 409);
    assert.deepEqual(state.saved, []);
  });

  it('una foto només la veuen el rider, el client, el venedor i l\'administrador, i mai es desa a la memòria cau', async () => {
    for (const as of ['rider', 'customer', 'seller', 'admin']) {
      const res = await call('GET', `/proofs/photos/${PHOTO}`, { as });
      assert.equal(res.status, 200, as);
      assert.equal(res.headers.get('content-type'), 'image/jpeg');
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal((await call('GET', `/proofs/photos/${PHOTO}`, { as: 'stranger' })).status, 404);
    assert.equal((await call('GET', `/proofs/photos/${PHOTO}`, { as: null })).status, 401);
  });
});

describe('completar el servei', () => {
  it('desa el checklist; el material no correcte necessita una explicació', async () => {
    const ok = await call('POST', `/rider/services/${SERVICE}/complete`, { body: { items: [{ eventItemId: ITEM, condition: 'correct' }] } });
    assert.equal(ok.status, 200);
    assert.deepEqual(state.completed, [{ eventItemId: ITEM, condition: 'correct', note: null }]);
    for (const items of [[], [{ eventItemId: ITEM, condition: 'damaged' }], [{ eventItemId: ITEM, condition: 'perdut' }], [{ eventItemId: 'x', condition: 'correct' }]]) {
      assert.equal((await call('POST', `/rider/services/${SERVICE}/complete`, { body: { items } })).status, 400, JSON.stringify(items));
    }
  });

  it('registrar una incidència exigeix el motiu i l\'explicació', async () => {
    assert.equal((await call('POST', `/rider/services/${SERVICE}/incident`, { body: { kind: 'robo', description: 'Algo' } })).status, 400);
    assert.equal((await call('POST', `/rider/services/${SERVICE}/incident`, { body: { kind: 'customer_absent', description: '' } })).status, 400);
    const { status } = await call('POST', `/rider/services/${SERVICE}/incident`, { body: { kind: 'customer_absent', description: 'Nadie abre' } });
    assert.equal(status, 201);
    assert.deepEqual(state.reported, { kind: 'customer_absent', description: 'Nadie abre', photoId: null });
  });
});

describe('les rutes de proves no tanquen la resta de l\'API', () => {
  it('una ruta qualsevol sense sessió continua responent com abans (404, no 401)', async () => {
    const res = await fetch(`${base}/no-existeix`);
    assert.equal(res.status, 404);
  });
});

describe('consulta i administració', () => {
  it('la prova d\'un servei respon 404 a qui no la pot veure', async () => {
    assert.equal((await call('GET', `/services/${SERVICE}/proof`, { as: 'customer' })).status, 200);
    assert.equal((await call('GET', `/services/${SERVICE}/proof`, { as: 'stranger' })).status, 404);
  });

  it('el venedor veu els seus serveis; les incidències només les gestiona l\'administrador', async () => {
    assert.equal((await call('GET', '/seller/services', { as: 'seller' })).body.data[0].sellerId, 'a1');
    assert.equal((await call('GET', '/admin/incidents', { as: 'seller' })).status, 403);
    assert.equal((await call('GET', '/admin/incidents?status=open', { as: 'admin' })).status, 200);
    assert.equal((await call('GET', '/admin/incidents?status=tot', { as: 'admin' })).status, 400);
    assert.equal((await call('POST', '/admin/incidents/f1000000-0000-4000-8000-000000000001/resolve', { as: 'admin', body: { note: '' } })).status, 400);
    const resolved = await call('POST', '/admin/incidents/f1000000-0000-4000-8000-000000000001/resolve', { as: 'admin', body: { note: 'Resuelta con el cliente' } });
    assert.equal(resolved.body.data.resolved, true);
  });
});
