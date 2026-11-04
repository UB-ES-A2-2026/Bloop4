import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';

const EVENT = { id: 'e1', startsAt: new Date('2030-07-04T08:00:00Z'), endsAt: new Date('2030-07-05T09:00:00Z') };
const USERS = { client: { id: 'u1', status: 'active', roles: ['customer'] }, seller: { id: 'u2', status: 'active', roles: ['seller'] } };

/** Franges de 2 h (08:00–22:00 a Madrid, +02:00 a l'estiu) d'un dia, totes amb capacitat. */
function daySlots(date, full = []) {
  return Array.from({ length: 7 }, (_, i) => {
    const hour = String(8 + i * 2).padStart(2, '0');
    const startsAt = new Date(`${date}T${hour}:00:00+02:00`);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000), hasCapacity: !full.includes(hour) };
  });
}

const state = {};
const cartRepository = {
  async findDraft() { return state.draft; },
  async getCart() {
    return { id: 'e1', startsAt: EVENT.startsAt, endsAt: EVENT.endsAt, billableDays: 2, currency: 'EUR',
      sellers: state.empty ? [] : [{ seller: { id: 's1' }, items: [{ id: 'i1', product: { id: 'p1', status: 'published' }, quantity: 1, dailyPrice: '45.00', currentDailyPrice: '45.00' }] }],
      totals: { rental: '90.00', deposit: '150.00', toPay: '90.00' } };
  },
  async expireStale() {},
};
const deliveryRepository = {
  async uncoveredSellers(eventId, postalCode) { return postalCode === '46001' ? [] : [{ id: 's1', legalName: 'Sonido Levante S.L.' }]; },
  async slots(eventId, date) { return daySlots(date, state.full); },
  async saveDelivery(eventId, userId, delivery) { state.saved = { eventId, userId, ...delivery }; },
  async getDelivery() { return state.delivery; },
  async addAmounts(a, b) { return (Number(a) + Number(b)).toFixed(2); },
};
const availabilityRepository = { async check() { return { availableUnits: 5 }; } };
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, cartRepository, deliveryRepository, availabilityRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { draft: EVENT, empty: false, full: [], saved: null, delivery: null }));

async function call(method, path, { as = 'client', body } = {}) {
  const headers = { Cookie: `bloop4_session=${as}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

const VALID = {
  street: 'Calle Ficticia 2', postalCode: '46001', city: 'Valencia',
  deliveryStartsAt: '2030-07-04T08:00:00+02:00', pickupStartsAt: '2030-07-05T12:00:00+02:00',
};

describe('GET /api/delivery-slots', () => {
  it('retorna les franges del dia de la cistella del client', async () => {
    const { status, body } = await call('GET', '/delivery-slots?postalCode=46001&date=2030-07-04');
    assert.equal(status, 200);
    assert.equal(body.data.slots.length, 7);
    assert.ok(body.data.slots.every((s) => s.available));
  });

  it('les franges plenes o a menys de 24 h no estan disponibles', async () => {
    state.full = ['10'];
    let { body } = await call('GET', '/delivery-slots?postalCode=46001&date=2030-07-04');
    assert.deepEqual(body.data.slots.map((s) => s.available), [true, false, true, true, true, true, true]);
    const tomorrow = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
    ({ body } = await call('GET', `/delivery-slots?postalCode=46001&date=${tomorrow}`));
    assert.ok(body.data.slots.every((s) => !s.available || new Date(s.startsAt) - Date.now() >= 24 * 3600_000));
  });

  it('fora de cobertura → 400 OUT_OF_COVERAGE amb els venedors que no hi arriben', async () => {
    const { status, body } = await call('GET', '/delivery-slots?postalCode=08001&date=2030-07-04');
    assert.equal(status, 400);
    assert.deepEqual(body.error, {
      code: 'OUT_OF_COVERAGE',
      message: 'Esta dirección está fuera de la zona de reparto',
      details: { sellers: ['Sonido Levante S.L.'] },
    });
  });

  it('valida el codi postal, la data i que la cistella no sigui buida; només per a clients', async () => {
    assert.equal((await call('GET', '/delivery-slots?postalCode=4600&date=2030-07-04')).status, 400);
    assert.equal((await call('GET', '/delivery-slots?postalCode=46001&date=04/07/2030')).status, 400);
    state.empty = true;
    assert.match((await call('GET', '/delivery-slots?postalCode=46001&date=2030-07-04')).body.error.message, /vacía/);
    assert.equal((await call('GET', '/delivery-slots?postalCode=46001&date=2030-07-04', { as: 'seller' })).status, 403);
  });
});

describe('PUT /api/cart/delivery', () => {
  it('desa l\'adreça i les franges de 2 h', async () => {
    const { status } = await call('PUT', '/cart/delivery', { body: { ...VALID, accessInstructions: '  Planta 2  ' } });
    assert.equal(status, 200);
    assert.equal(state.saved.address.accessInstructions, 'Planta 2');
    assert.equal(state.saved.deliveryWindow.endsAt.toISOString(), '2030-07-04T08:00:00.000Z');
    assert.equal(state.saved.pickupWindow.startsAt.toISOString(), '2030-07-05T10:00:00.000Z');
  });

  it('el lliurament acaba abans de l\'inici i la recollida comença després del final', async () => {
    let { status, body } = await call('PUT', '/cart/delivery', { body: { ...VALID, deliveryStartsAt: '2030-07-04T10:00:00+02:00' } });
    assert.equal(status, 400);
    assert.match(body.error.message, /antes de que empiece/);
    ({ status, body } = await call('PUT', '/cart/delivery', { body: { ...VALID, pickupStartsAt: '2030-07-05T10:00:00+02:00' } }));
    assert.match(body.error.message, /después de que termine/);
    assert.equal(state.saved, null);
  });

  it('rebutja franges que no existeixen, plenes o fora de cobertura', async () => {
    assert.match((await call('PUT', '/cart/delivery', { body: { ...VALID, deliveryStartsAt: '2030-07-04T07:00:00+02:00' } })).body.error.message, /franjas de 2 h/);
    state.full = ['08'];
    assert.match((await call('PUT', '/cart/delivery', { body: VALID })).body.error.message, /ya no está disponible/);
    assert.equal((await call('PUT', '/cart/delivery', { body: { ...VALID, postalCode: '08001' } })).body.error.code, 'OUT_OF_COVERAGE');
    assert.equal(state.saved, null);
  });

  it('l\'adreça i la ciutat són obligatòries', async () => {
    assert.equal((await call('PUT', '/cart/delivery', { body: { ...VALID, street: ' ' } })).status, 400);
    assert.equal((await call('PUT', '/cart/delivery', { body: { ...VALID, city: '' } })).status, 400);
  });
});

describe('la cistella amb el lliurament', () => {
  const delivery = (deliveryEnd, pickupStart) => ({
    address: { street: 'Calle Ficticia 2', postalCode: '46001', city: 'Valencia', accessInstructions: null },
    deliveryWindow: { startsAt: '2030-07-04T06:00:00.000Z', endsAt: deliveryEnd },
    pickupWindow: { startsAt: pickupStart, endsAt: '2030-07-05T12:00:00.000Z' },
    transport: [{ seller: { id: 's1' }, vehicle: { type: 'car' }, price: '25.00', currency: 'EUR' }],
    transportTotal: '25.00',
  });

  it('el transport suma al total a pagar i la reserva queda llesta per al pagament', async () => {
    state.delivery = delivery('2030-07-04T08:00:00.000Z', '2030-07-05T10:00:00.000Z');
    const { body } = await call('GET', '/cart');
    assert.deepEqual(body.data.totals, { rental: '90.00', deposit: '150.00', toPay: '115.00', transport: '25.00' });
    assert.equal(body.data.delivery.valid, true);
    assert.equal(body.data.readyForPayment, true);
  });

  it('si les dates de l\'esdeveniment canvien, les franges deixen de ser vàlides', async () => {
    state.delivery = delivery('2030-07-04T10:00:00.000Z', '2030-07-05T10:00:00.000Z');
    const { body } = await call('GET', '/cart');
    assert.equal(body.data.delivery.valid, false);
    assert.equal(body.data.readyForPayment, false);
  });
});
