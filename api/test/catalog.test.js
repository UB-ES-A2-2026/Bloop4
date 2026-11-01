import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const CAT = 'c0000000-0000-4000-8000-000000000001';

// Repositori fals: registra les crides per comprovar què rep de la ruta.
const calls = [];
const repo = {
  fail: false,
  async listCategories() {
    if (this.fail) throw new Error('boom');
    return [{ id: CAT, parentId: null, name: 'Sonido', slug: 'sonido', sortOrder: 1, productCount: 0 }];
  },
  async listProducts(params) {
    calls.push(params);
    return { items: [{ id: 'p1' }], totalItems: 30 };
  },
  async ping() {},
};

let server;
let base;
before(async () => {
  const silent = { error() {} };
  server = createApp({ catalogRepository: repo, logger: silent }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  calls.length = 0;
  repo.fail = false;
});

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

describe('GET /api/categories', () => {
  it('retorna les categories dins de data', async () => {
    const { status, body } = await get('/api/categories');
    assert.equal(status, 200);
    assert.equal(body.data[0].slug, 'sonido');
  });

  it('amaga els detalls d\'un error intern', async () => {
    repo.fail = true;
    const { status, body } = await get('/api/categories');
    assert.equal(status, 500);
    assert.deepEqual(body, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
  });
});

describe('GET /api/products', () => {
  it('fa servir la paginació per defecte i cap filtre de categoria', async () => {
    const { status, body } = await get('/api/products');
    assert.equal(status, 200);
    assert.deepEqual(calls[0], { categoryIds: null, q: null, limit: 24, offset: 0 });
    assert.deepEqual(body.pagination, { page: 1, pageSize: 24, totalItems: 30, totalPages: 2 });
  });

  it('accepta categoryId separat per comes o repetit, sense duplicats', async () => {
    const other = 'c0000000-0000-4000-8000-000000000002';
    await get(`/api/products?categoryId=${CAT},${other}&categoryId=${CAT.toUpperCase()}&page=2&pageSize=10`);
    assert.deepEqual(calls[0], { categoryIds: [CAT, other], q: null, limit: 10, offset: 10 });
  });

  it('rebutja UUID no vàlids amb 400 VALIDATION_ERROR', async () => {
    const { status, body } = await get("/api/products?categoryId=1' OR 1=1");
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(calls.length, 0);
  });

  it('rebutja page i pageSize fora de rang', async () => {
    assert.equal((await get('/api/products?page=0')).status, 400);
    assert.equal((await get('/api/products?pageSize=101')).status, 400);
    assert.equal((await get('/api/products?pageSize=abc')).status, 400);
    assert.equal((await get('/api/products?page=10001')).status, 400);
  });

  it('rebutja números que Number() acceptaria però no són enters simples', async () => {
    for (const page of ['1e300', '0x2', '1.0', '-1', ' 2']) {
      assert.equal((await get(`/api/products?page=${encodeURIComponent(page)}`)).status, 400, page);
    }
    assert.equal(calls.length, 0);
  });
});

describe('GET /api/products · cerca (q)', () => {
  it('passa el text retallat al repositori', async () => {
    const { status } = await get('/api/products?q=%20%20altavoz%20');
    assert.equal(status, 200);
    assert.equal(calls[0].q, 'altavoz');
  });

  it('combina la cerca amb el filtre de categoria', async () => {
    await get(`/api/products?q=micro&categoryId=${CAT}`);
    assert.deepEqual(calls[0], { categoryIds: [CAT], q: 'micro', limit: 24, offset: 0 });
  });

  it('rebutja q de menys de 2 o més de 100 caràcters amb 400 VALIDATION_ERROR', async () => {
    for (const q of ['a', '  b  ', '', 'x'.repeat(101)]) {
      const { status, body } = await get(`/api/products?q=${encodeURIComponent(q)}`);
      assert.equal(status, 400, JSON.stringify(q));
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(calls.length, 0);
  });

  it('accepta exactament 2 i 100 caràcters', async () => {
    assert.equal((await get('/api/products?q=ab')).status, 200);
    assert.equal((await get(`/api/products?q=${'x'.repeat(100)}`)).status, 200);
  });

  it('rebutja q repetit', async () => {
    assert.equal((await get('/api/products?q=ab&q=cd')).status, 400);
  });

  it('tracta els caràcters especials com a text', async () => {
    const q = "%_';--";
    const { status } = await get(`/api/products?q=${encodeURIComponent(q)}`);
    assert.equal(status, 200);
    assert.equal(calls[0].q, q);
  });
});

describe('altres rutes', () => {
  it('GET /api/health respon ok', async () => {
    assert.deepEqual((await get('/api/health')).body, { status: 'ok' });
  });

  it('404 amb el format d\'error comú', async () => {
    const { status, body } = await get('/api/nope');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
