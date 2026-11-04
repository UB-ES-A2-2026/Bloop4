import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';

const PRODUCT = 'd0000000-0000-4000-8000-000000000001';
const ITEM = 'f2000000-0000-4000-8000-000000000001';
const FUTURE = { startsAt: '2030-07-04T10:00:00+02:00', endsAt: '2030-07-05T10:00:00+02:00' };
const USERS = {
  client: { id: 'u1', status: 'active', roles: ['customer'] },
  other: { id: 'u2', status: 'active', roles: ['customer'] },
  pending: { id: 'u3', status: 'pending_verification', roles: ['customer'] },
  seller: { id: 'u4', status: 'active', roles: ['seller'] },
};

const state = {};
const line = (overrides = {}) => ({
  id: ITEM, product: { id: PRODUCT, name: 'Altavoz', status: 'published' }, quantity: 2,
  dailyPrice: '45.00', currentDailyPrice: '45.00', depositAmount: '150.00', currency: 'EUR', ...overrides,
});
const cartRepository = {
  async expireStale(userId) { state.expired.push(userId); },
  async findDraft() { return state.draft; },
  async saveDates(userId, dates) { state.dates = dates; state.draft = { id: 'e1', startsAt: dates.startsAt, endsAt: dates.endsAt }; return 'e1'; },
  async findItem(id) { return id === ITEM ? { eventId: 'e1', productId: PRODUCT, customerId: state.itemOwner, status: state.itemStatus } : null; },
  async quantityOf() { return state.existing; },
  async isPublished(id) { return id === PRODUCT; },
  async setItem(eventId, productId, quantity) { state.saved = quantity; },
  async deleteItem(eventId, itemId) { state.deleted = itemId; },
  async getCart() {
    return { id: 'e1', startsAt: FUTURE.startsAt, endsAt: FUTURE.endsAt, billableDays: 1, currency: 'EUR',
      sellers: [{ seller: { id: 's1' }, items: [state.line] }], totals: { rental: '90.00', deposit: '300.00', toPay: '90.00' } };
  },
};
const availabilityRepository = { async check() { return { availableUnits: state.available }; } };
const authRepository = {
  async findSessionUser(tokenHash) { return Object.entries(USERS).find(([name]) => hashToken(name) === tokenHash)?.[1] ?? null; },
};

let server;
let base;
before(async () => {
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, cartRepository, availabilityRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/cart`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, {
  draft: { id: 'e1', startsAt: new Date(FUTURE.startsAt), endsAt: new Date(FUTURE.endsAt) },
  existing: 0, available: 4, saved: null, deleted: null, dates: null, expired: [], itemOwner: 'u1', itemStatus: 'draft', line: line(),
}));

async function call(method, path = '', { as = 'client', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

describe('accés a /api/cart', () => {
  it('sense sessió 401; un venedor que no és client 403; un compte sense verificar no pot modificar-la', async () => {
    assert.equal((await call('GET', '', { as: null })).status, 401);
    assert.equal((await call('GET', '', { as: 'seller' })).status, 403);
    assert.equal((await call('GET', '', { as: 'pending' })).status, 200);
    assert.equal((await call('PUT', '', { as: 'pending', body: FUTURE })).status, 403);
  });

  it('sense cistella retorna una cistella buida i abans de llegir-la la fa caducar si cal', async () => {
    state.draft = null;
    const { body } = await call('GET');
    assert.deepEqual(body.data.sellers, []);
    assert.equal(body.data.canCheckout, false);
    assert.deepEqual(state.expired, ['u1']);
  });
});

describe('dates de la cistella', () => {
  it('desa les dates com a instants', async () => {
    assert.equal((await call('PUT', '', { body: FUTURE })).status, 200);
    assert.equal(state.dates.startsAt.toISOString(), '2030-07-04T08:00:00.000Z');
  });

  it('rebutja dates sense zona, al passat o amb la fi abans de l\'inici', async () => {
    for (const body of [
      { startsAt: '2030-07-04T10:00', endsAt: '2030-07-05T10:00' },
      { startsAt: '2020-07-04T10:00:00Z', endsAt: '2020-07-05T10:00:00Z' },
      { startsAt: FUTURE.endsAt, endsAt: FUTURE.startsAt },
    ]) {
      assert.equal((await call('PUT', '', { body })).status, 400, JSON.stringify(body));
    }
    assert.equal(state.dates, null);
  });
});

describe('afegir i canviar línies', () => {
  it('sense dates no es pot afegir res', async () => {
    state.draft = null;
    const { status, body } = await call('POST', '/items', { body: { productId: PRODUCT, quantity: 1 } });
    assert.equal(status, 400);
    assert.match(body.error.message, /fechas del evento/);
  });

  it('afegir un producte que ja hi és suma les quantitats', async () => {
    state.existing = 2;
    assert.equal((await call('POST', '/items', { body: { productId: PRODUCT, quantity: 1 } })).status, 201);
    assert.equal(state.saved, 3);
  });

  it('més unitats de les disponibles → 409 CONFLICT amb availableUnits', async () => {
    state.existing = 2;
    state.available = 2;
    const { status, body } = await call('POST', '/items', { body: { productId: PRODUCT, quantity: 1 } });
    assert.equal(status, 409);
    assert.equal(body.error.code, 'CONFLICT');
    assert.deepEqual(body.error.details, { availableUnits: 2 });
    assert.equal(state.saved, null);
  });

  it('producte inexistent → 404; quantitats invàlides → 400', async () => {
    assert.equal((await call('POST', '/items', { body: { productId: 'd0000000-0000-4000-8000-000000000099', quantity: 1 } })).status, 404);
    for (const quantity of [0, -1, 1.5, '2', 501]) {
      assert.equal((await call('POST', '/items', { body: { productId: PRODUCT, quantity } })).status, 400, String(quantity));
    }
  });

  it('PATCH és idempotent: desa la quantitat final', async () => {
    await call('PATCH', `/items/${ITEM}`, { body: { quantity: 3 } });
    await call('PATCH', `/items/${ITEM}`, { body: { quantity: 3 } });
    assert.equal(state.saved, 3);
  });

  it('una línia d\'un altre client → 403; d\'una reserva ja confirmada → 403; inexistent → 404', async () => {
    state.itemOwner = 'u2';
    assert.equal((await call('PATCH', `/items/${ITEM}`, { body: { quantity: 1 } })).status, 403);
    assert.equal((await call('DELETE', `/items/${ITEM}`)).status, 403);
    state.itemOwner = 'u1';
    state.itemStatus = 'confirmed';
    assert.equal((await call('PATCH', `/items/${ITEM}`, { body: { quantity: 1 } })).status, 403);
    assert.equal((await call('DELETE', '/items/f2000000-0000-4000-8000-000000000099')).status, 404);
    assert.equal(state.saved, null);
    assert.equal(state.deleted, null);
  });

  it('DELETE esborra la línia', async () => {
    assert.equal((await call('DELETE', `/items/${ITEM}`)).status, 204);
    assert.equal(state.deleted, ITEM);
  });
});

describe('revalidació en llegir la cistella', () => {
  it('sense canvis es pot continuar', async () => {
    const { body } = await call('GET');
    assert.equal(body.data.canCheckout, true);
    assert.deepEqual(body.data.sellers[0].items[0].warnings, []);
  });

  it('marca els canvis de preu, la manca d\'unitats i els productes retirats', async () => {
    state.line = line({ currentDailyPrice: '50.00' });
    state.available = 1;
    let { body } = await call('GET');
    assert.deepEqual(body.data.sellers[0].items[0].warnings, [
      { code: 'PRICE_CHANGED', currentDailyPrice: '50.00' },
      { code: 'UNAVAILABLE', availableUnits: 1 },
    ]);
    assert.equal(body.data.canCheckout, false);

    state.line = line({ product: { id: PRODUCT, name: 'Altavoz', status: 'draft' } });
    ({ body } = await call('GET'));
    assert.deepEqual(body.data.sellers[0].items[0].warnings, [{ code: 'UNPUBLISHED' }]);
  });
});
