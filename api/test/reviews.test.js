import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';
import { conflictError } from '../src/errors.js';

const PRODUCT = 'd0000000-0000-4000-8000-000000000001';
const BOOKING = 'f0000000-0000-4000-8000-000000000004';
const USERS = {
  client: { id: 'u1', status: 'active', roles: ['customer'] },
  pending: { id: 'u3', status: 'pending_verification', roles: ['customer'] },
  seller: { id: 'u4', status: 'active', roles: ['seller'] },
  admin: { id: 'a1', status: 'active', roles: ['admin'] },
};
const state = {};
/** Resposta del repositori: la reserva BOOKING, finalitzada i sense valorar, si no es diu el contrari. */
const eligibility = ({ finished = true, reviewed = false, mine = true } = {}) => {
  const history = mine ? [{ bookingId: BOOKING, finished, reviewed }] : [];
  const bookings = history.filter((b) => b.finished && !b.reviewed).map(({ bookingId }) => ({ bookingId }));
  const reason = bookings.length ? null : !mine ? 'NOT_RENTED' : reviewed ? 'ALREADY_REVIEWED' : 'NOT_FINISHED';
  return { bookings, reason, reviewAgainLater: false, history };
};
const reviewRepository = {
  async list(productId, page) { state.listed = page; return { reviews: [{ id: 'r1', rating: 5, comment: '<b>hola</b>' }], total: 21 }; },
  async eligibility() { return state.eligibility; },
  async create(review) {
    if (state.duplicate) throw conflictError('Ya has valorado este producto para esta reserva');
    state.created = review;
    return { id: 'r2', ...review };
  },
  async hide(id) { state.hidden = id; return id !== 'f0000000-0000-4000-8000-0000000000ff'; },
};
const catalogRepository = { async ping() {}, async getProduct(id) { return id === PRODUCT ? { id } : null; }, async listCategories() { return []; } };
const authRepository = { async findSessionUser(h) { return Object.entries(USERS).find(([n]) => hashToken(n) === h)?.[1] ?? null; } };

let server;
let base;
before(async () => {
  const app = createApp({ catalogRepository, authRepository, loginAttempts: {}, mailer: {}, reviewRepository, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, {
  eligibility: eligibility(), created: null, duplicate: false, hidden: null, listed: null,
}));

async function call(method, path, { as = 'client', body } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
const valid = { bookingId: BOOKING, rating: 4, comment: '  Muy bien  ' };

describe('GET /api/products/:id/reviews', () => {
  it('és públic i paginat; el comentari arriba tal qual (el frontend el mostra com a text)', async () => {
    const { status, body } = await call('GET', `/products/${PRODUCT}/reviews?page=3&pageSize=5`, { as: null });
    assert.equal(status, 200);
    assert.deepEqual(state.listed, { limit: 5, offset: 10 });
    assert.deepEqual(body.pagination, { page: 3, pageSize: 5, totalItems: 21, totalPages: 5 });
    assert.equal(body.data[0].comment, '<b>hola</b>');
  });

  it('producte inexistent 404; paràmetres invàlids 400', async () => {
    assert.equal((await call('GET', '/products/d0000000-0000-4000-8000-000000000099/reviews')).status, 404);
    assert.equal((await call('GET', `/products/${PRODUCT}/reviews?pageSize=500`)).status, 400);
    assert.equal((await call('GET', `/products/${PRODUCT}/reviews?page=0`)).status, 400);
  });
});

describe('GET /api/products/:id/reviews/eligibility', () => {
  it('sense sessió demana iniciar-la; un venedor no ha llogat res; un client veu les seves reserves', async () => {
    assert.equal((await call('GET', `/products/${PRODUCT}/reviews/eligibility`, { as: null })).body.data.reason, 'LOGIN');
    assert.equal((await call('GET', `/products/${PRODUCT}/reviews/eligibility`, { as: 'seller' })).body.data.reason, 'NOT_RENTED');
    assert.deepEqual((await call('GET', `/products/${PRODUCT}/reviews/eligibility`)).body.data, {
      canReview: true, reason: null, reviewAgainLater: false, bookings: [{ bookingId: BOOKING }],
    });
    // L'historial de reserves és intern: no surt a la resposta.
    state.eligibility = { ...eligibility({ reviewed: true }), reviewAgainLater: true };
    assert.deepEqual((await call('GET', `/products/${PRODUCT}/reviews/eligibility`)).body.data, {
      canReview: false, reason: 'ALREADY_REVIEWED', reviewAgainLater: true, bookings: [],
    });
  });
});

describe('POST /api/products/:id/reviews', () => {
  it('publica la valoració amb el comentari net', async () => {
    const { status } = await call('POST', `/products/${PRODUCT}/reviews`, { body: valid });
    assert.equal(status, 201);
    assert.deepEqual(state.created, { productId: PRODUCT, bookingId: BOOKING, customerId: 'u1', rating: 4, comment: 'Muy bien' });
  });

  it('sense sessió 401; sense verificar o sense ser client 403', async () => {
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { as: null, body: valid })).status, 401);
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { as: 'pending', body: valid })).status, 403);
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { as: 'seller', body: valid })).status, 403);
  });

  it('sense haver-lo llogat o abans d\'acabar la reserva 403; ja valorat 409', async () => {
    state.eligibility = eligibility({ mine: false });
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body: valid })).body.error.details.reason, 'NOT_RENTED');
    state.eligibility = eligibility({ finished: false });
    const finished = await call('POST', `/products/${PRODUCT}/reviews`, { body: valid });
    assert.deepEqual([finished.status, finished.body.error.details.reason], [403, 'NOT_FINISHED']);
    state.eligibility = eligibility({ reviewed: true });
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body: valid })).status, 409);
    state.eligibility = eligibility();
    state.duplicate = true;
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body: valid })).status, 409);
    assert.equal(state.created, null);
  });

  it('una reserva que no és de les permeses 403; puntuació fora d\'1–5 o comentari massa llarg 400', async () => {
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body: { ...valid, bookingId: 'f0000000-0000-4000-8000-000000000001' } })).status, 403);
    for (const body of [{ ...valid, rating: 0 }, { ...valid, rating: 6 }, { ...valid, rating: 4.5 }, { ...valid, rating: '5' }, { ...valid, comment: 'a'.repeat(1001) }, { ...valid, bookingId: 'x' }]) {
      assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body })).status, 400, JSON.stringify(body).slice(0, 60));
    }
    assert.equal((await call('POST', `/products/${PRODUCT}/reviews`, { body: { ...valid, comment: 'a'.repeat(1000) } })).status, 201);
  });
});

describe('POST /api/admin/reviews/:id/hide', () => {
  it('només un administrador; una valoració inexistent 404', async () => {
    assert.equal((await call('POST', '/admin/reviews/f0000000-0000-4000-8000-000000000001/hide')).status, 403);
    assert.equal((await call('POST', '/admin/reviews/f0000000-0000-4000-8000-000000000001/hide', { as: 'admin' })).status, 204);
    assert.equal((await call('POST', '/admin/reviews/f0000000-0000-4000-8000-0000000000ff/hide', { as: 'admin' })).status, 404);
  });
});
