import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const ID = 'd0000000-0000-4000-8000-000000000014';
const DAY = 24 * 60 * 60 * 1000;
const future = (days, hours = 0) => new Date(Date.now() + days * DAY + hours * 3600_000).toISOString();

const state = {};
const availabilityRepository = {
  async check(id, range) {
    state.checks.push(range);
    if (id !== ID) return null;
    return { availableUnits: state.available(range), totalUnits: 2, billableDays: 1, totalPrice: '180.00', currency: 'EUR' };
  },
  async unavailableDays(id, month) {
    state.months.push(month);
    return id === ID ? ['2030-06-15'] : null;
  },
};

let server;
let base;
before(async () => {
  server = createApp({ catalogRepository: { ping: async () => {} }, availabilityRepository, logger: { error() {} } }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/products`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { checks: [], months: [], available: () => 1 }));

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};
const query = (from, to) => `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

describe('GET /api/products/:id/availability', () => {
  it('retorna unitats, preu total i cap suggeriment si n\'hi ha de lliures', async () => {
    const { status, body } = await get(`/${ID}/availability${query(future(10), future(11))}`);
    assert.equal(status, 200);
    assert.equal(body.data.availableUnits, 1);
    assert.equal(body.data.totalPrice, '180.00');
    assert.deepEqual(body.data.suggestions, []);
  });

  it('accepta dates amb Z o amb desplaçament i les passa al repositori com a instants', async () => {
    await get(`/${ID}/availability${query('2030-06-15T10:00:00+02:00', '2030-06-15T22:00:00Z')}`);
    assert.equal(state.checks[0].from.toISOString(), '2030-06-15T08:00:00.000Z');
  });

  it('sense disponibilitat proposa fins a 3 dates properes amb unitats lliures', async () => {
    const asked = new Date(future(10)).getTime();
    state.available = ({ from }) => (from.getTime() === asked ? 0 : (from.getTime() - asked) / DAY >= 2 ? 1 : 0);
    const { body } = await get(`/${ID}/availability${query(future(10), future(11))}`);
    assert.equal(body.data.availableUnits, 0);
    assert.equal(body.data.suggestions.length, 3);
    assert.equal(new Date(body.data.suggestions[0].from).getTime() - asked, 2 * DAY);
  });

  it('valida les dates: format amb zona, fi posterior a l\'inici i no al passat', async () => {
    for (const [from, to] of [
      ['2030-06-15T10:00:00', '2030-06-15T12:00:00Z'],
      ['15/06/2030', '2030-06-15T12:00:00Z'],
      [future(10), future(10)],
      [future(11), future(10)],
      [future(-1), future(1)],
    ]) {
      const { status, body } = await get(`/${ID}/availability${query(from, to)}`);
      assert.equal(status, 400, `${from} → ${to}`);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(state.checks.length, 0);
  });

  it('producte inexistent o no publicat → 404; id invàlid → 400', async () => {
    assert.equal((await get(`/d0000000-0000-4000-8000-000000000099/availability${query(future(1), future(2))}`)).status, 404);
    assert.equal((await get(`/123/availability${query(future(1), future(2))}`)).status, 400);
  });
});

describe('GET /api/products/:id/availability/calendar', () => {
  it('retorna els dies sense unitats lliures del mes', async () => {
    const { status, body } = await get(`/${ID}/availability/calendar?month=2030-06`);
    assert.equal(status, 200);
    assert.deepEqual(body.data, { month: '2030-06', unavailableDays: ['2030-06-15'] });
  });

  it('valida el format del mes', async () => {
    for (const month of ['2030-13', '2030-6', 'juny', '']) {
      assert.equal((await get(`/${ID}/availability/calendar?month=${month}`)).status, 400, month);
    }
  });
});
