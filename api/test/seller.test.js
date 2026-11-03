import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/auth/tokens.js';

const OWN = 'd1000000-0000-4000-8000-000000000001';
const OTHER = 'd1000000-0000-4000-8000-000000000002';
const CAT = 'c0000000-0000-4000-8000-000000000006';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

const USERS = {
  seller: { id: 'u1', status: 'active', roles: ['seller'], seller: { id: 's1' } },
  pending: { id: 'u2', status: 'pending_verification', roles: ['seller'], seller: { id: 's1' } },
  customer: { id: 'u3', status: 'active', roles: ['customer'], seller: null },
};

const state = {};
function product(overrides = {}) {
  return {
    id: OWN, name: 'Barra LED', status: 'draft', category: { id: CAT }, dailyPrice: '10.00', depositAmount: '0.00',
    units: 2, weightKg: '2.00', lengthCm: '100.0', widthCm: '10.0', heightCm: '10.0', images: [{ id: 'i1' }], ...overrides,
  };
}
const sellerRepository = {
  async getSeller() { return { id: 's1', verified: state.verified }; },
  async categoryExists(id) { return id === CAT; },
  async getProductSellerId(id) { return { [OWN]: 's1', [OTHER]: 's2' }[id] ?? null; },
  async listProducts() { return [product()]; },
  async getProduct() { return state.product; },
  async createProduct(sellerId, fields) { state.created = { sellerId, fields }; return product({ ...fields }); },
  async updateProduct(sellerId, id, fields) { state.updated = fields; return product(fields); },
  async publishProduct() { state.published = true; return product({ status: 'published' }); },
  async addImage(id, image, max) { if (state.imageCount >= max) return null; state.imageCount++; return { id: 'new', ...image }; },
  async deleteImage(id, imageId) { return imageId === 'e0000000-0000-4000-8000-000000000001' ? '/uploads/products/x/y.jpg' : null; },
};
const imageStore = {
  async save(productId, buffer, ext) { state.saved.push(ext); return `/uploads/products/${productId}/foto.${ext}`; },
  async remove(path) { state.removed.push(path); },
};
const authRepository = {
  async findSessionUser(tokenHash) { return Object.entries(USERS).find(([name]) => hashToken(name) === tokenHash)?.[1] ?? null; },
};

let server;
let base;
before(async () => {
  const app = createApp({ catalogRepository: { ping: async () => {} }, authRepository, loginAttempts: {}, mailer: {}, sellerRepository, imageStore, logger: { error() {} } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/seller`;
});
after(() => server.close());
beforeEach(() => Object.assign(state, { verified: true, product: product(), imageCount: 0, saved: [], removed: [], created: null, updated: null, published: false }));

async function call(method, path, { as = 'seller', body, form } = {}) {
  const headers = as ? { Cookie: `bloop4_session=${as}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
const photo = (buffer, name = 'foto.jpg') => {
  const form = new FormData();
  form.append('photo', new Blob([buffer]), name);
  return form;
};
const VALID = { name: 'Barra LED', categoryId: CAT, dailyPrice: '10', units: 2 };

describe('accés a /api/seller', () => {
  it('sense sessió → 401; un client → 403', async () => {
    assert.equal((await call('GET', '/products', { as: null })).status, 401);
    assert.equal((await call('GET', '/products', { as: 'customer' })).status, 403);
    assert.equal((await call('GET', '/products')).status, 200);
  });

  it('un venedor amb el correu sense verificar pot mirar però no crear (403)', async () => {
    assert.equal((await call('GET', '/products', { as: 'pending' })).status, 200);
    assert.equal((await call('POST', '/products', { as: 'pending', body: VALID })).status, 403);
  });

  it('un producte d\'un altre venedor → 403; inexistent → 404', async () => {
    assert.equal((await call('PATCH', `/products/${OTHER}`, { body: { name: 'Robat' } })).status, 403);
    assert.equal((await call('PATCH', '/products/d1000000-0000-4000-8000-000000000099', { body: {} })).status, 404);
    assert.equal(state.updated, null);
  });
});

describe('crear i editar', () => {
  it('crea un esborrany amb els camps normalitzats', async () => {
    const { status } = await call('POST', '/products', { body: { ...VALID, specs: { Potencia: ' 40 W ', Buit: '' } } });
    assert.equal(status, 201);
    assert.deepEqual(state.created, { sellerId: 's1', fields: { name: 'Barra LED', categoryId: CAT, dailyPrice: '10', units: 2, specs: { Potencia: '40 W' } } });
  });

  it('valida nom, categoria, imports, mides i unitats', async () => {
    for (const body of [
      { ...VALID, name: 'ab' },
      { ...VALID, categoryId: 'no' },
      { ...VALID, categoryId: 'c0000000-0000-4000-8000-000000000099' },
      { ...VALID, dailyPrice: '1,5' },
      { ...VALID, dailyPrice: '-3' },
      { ...VALID, dailyPrice: undefined },
      { ...VALID, depositAmount: '10.555' },
      { ...VALID, weightKg: 0 },
      { ...VALID, units: 501 },
      { ...VALID, units: 1.5 },
      { ...VALID, specs: ['x'] },
    ]) {
      const { status, body: res } = await call('POST', '/products', { body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(res.error.code, 'VALIDATION_ERROR');
    }
  });

  it('PATCH només canvia els camps enviats', async () => {
    await call('PATCH', `/products/${OWN}`, { body: { dailyPrice: '12.50', insurance: '' } });
    assert.deepEqual(state.updated, { dailyPrice: '12.50', insurance: null });
  });
});

describe('publicar', () => {
  it('amb totes les dades → publicat', async () => {
    const { status, body } = await call('POST', `/products/${OWN}/publish`);
    assert.equal(status, 200);
    assert.equal(body.data.status, 'published');
  });

  it('indica què falta per publicar', async () => {
    state.product = product({ images: [], weightKg: null, dailyPrice: '0.00', units: 0 });
    const { status, body } = await call('POST', `/products/${OWN}/publish`);
    assert.equal(status, 400);
    assert.deepEqual(body.error.details.missing, ['images', 'dailyPrice', 'units', 'weightKg']);
    assert.equal(state.published, false);
  });

  it('un venedor no verificat no pot publicar (403)', async () => {
    state.verified = false;
    const { status, body } = await call('POST', `/products/${OWN}/publish`);
    assert.equal(status, 403);
    assert.match(body.error.message, /no está verificada/);
  });
});

describe('fotos', () => {
  it('accepta JPEG i PNG segons el contingut, no segons el nom', async () => {
    assert.equal((await call('POST', `/products/${OWN}/images`, { form: photo(JPEG, 'foto.png') })).status, 201);
    assert.equal((await call('POST', `/products/${OWN}/images`, { form: photo(PNG, '../../x.php') })).status, 201);
    assert.deepEqual(state.saved, ['jpg', 'png']);
  });

  it('rebutja formats no admesos i fotos de més de 10 MB', async () => {
    const fake = await call('POST', `/products/${OWN}/images`, { form: photo(Buffer.from('<?php echo 1; ?>'), 'foto.jpg') });
    assert.equal(fake.status, 400);
    assert.match(fake.body.error.message, /JPEG, PNG o WebP/);
    const big = await call('POST', `/products/${OWN}/images`, { form: photo(Buffer.alloc(10 * 1024 * 1024 + 1, 0xff)) });
    assert.equal(big.status, 400);
    assert.match(big.body.error.message, /10 MB/);
    assert.deepEqual(state.saved, []);
  });

  it('com a màxim 10 fotos: l\'onzena → 409 i el fitxer s\'esborra', async () => {
    state.imageCount = 10;
    const { status } = await call('POST', `/products/${OWN}/images`, { form: photo(JPEG) });
    assert.equal(status, 409);
    assert.equal(state.removed.length, 1);
  });

  it('esborrar una foto esborra també el fitxer; una d\'inexistent → 404', async () => {
    assert.equal((await call('DELETE', `/products/${OWN}/images/e0000000-0000-4000-8000-000000000001`)).status, 204);
    assert.deepEqual(state.removed, ['/uploads/products/x/y.jpg']);
    assert.equal((await call('DELETE', `/products/${OWN}/images/e0000000-0000-4000-8000-000000000002`)).status, 404);
  });
});
