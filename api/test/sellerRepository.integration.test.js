// Prova l'SQL dels productes del venedor contra PostgreSQL amb els seeds carregats.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createCatalogRepository } from '../src/repositories/catalogRepository.js';
import { createSellerRepository } from '../src/repositories/sellerRepository.js';

const SONIDO = 'a0000000-0000-4000-8000-000000000001';
const FOCOS = 'c0000000-0000-4000-8000-000000000006';
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('sellerRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createSellerRepository(pool);
  const catalog = skip ? null : createCatalogRepository(pool);
  const created = [];

  // Els productes de prova s'esborren al final: el smoke test de la CI compta els del catàleg.
  after(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM product_images WHERE product_id = ANY($1::uuid[])', [created]);
    await pool.query('DELETE FROM product_units WHERE product_id = ANY($1::uuid[])', [created]);
    await pool.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [created]);
    await pool.end();
  });

  const create = async (fields) => {
    const p = await repo.createProduct(SONIDO, { categoryId: FOCOS, dailyPrice: '5.00', ...fields });
    created.push(p.id);
    return p;
  };

  const units = async (id) =>
    (await pool.query("SELECT status, count(*)::int AS n FROM product_units WHERE product_id = $1 GROUP BY status ORDER BY status", [id])).rows;

  it('un esborrany nou té les seves unitats al magatzem del venedor i no surt al catàleg', async () => {
    const before = (await catalog.listProducts({ categoryIds: null, q: null, limit: 100, offset: 0 })).totalItems;
    const p = await create({ name: 'Esborrany de prova', units: 3 });
    assert.equal(p.status, 'draft');
    assert.equal(p.units, 3);
    assert.equal(await catalog.getProduct(p.id), null);
    assert.equal((await catalog.listProducts({ categoryIds: null, q: null, limit: 100, offset: 0 })).totalItems, before);

    await repo.publishProduct(p.id);
    assert.equal((await catalog.getProduct(p.id)).name, 'Esborrany de prova');
  });

  it('reduir les unitats retira les disponibles; augmentar-les en crea de noves', async () => {
    const p = await create({ name: 'Unitats de prova', units: 4 });
    await repo.updateProduct(SONIDO, p.id, { units: 1 });
    assert.deepEqual(await units(p.id), [{ status: 'available', n: 1 }, { status: 'retired', n: 3 }]);
    assert.equal((await repo.updateProduct(SONIDO, p.id, { units: 2, specs: { Potencia: '40 W' } })).units, 2);
    assert.deepEqual((await repo.getProduct(p.id)).specs, { Potencia: '40 W' });
  });

  it('no deixa passar de 10 fotos', async () => {
    const p = await create({ name: 'Fotos de prova' });
    for (let i = 0; i < 10; i++) {
      assert.ok(await repo.addImage(p.id, { path: `/uploads/products/${p.id}/${i}.jpg`, altText: 'x' }, 10));
    }
    assert.equal(await repo.addImage(p.id, { path: `/uploads/products/${p.id}/11.jpg`, altText: 'x' }, 10), null);
    const { images } = await repo.getProduct(p.id);
    assert.equal(images.length, 10);
    assert.equal(await repo.deleteImage(p.id, images[0].id), images[0].path);
  });

  it('el propietari d\'un producte i la verificació del venedor', async () => {
    assert.equal(await repo.getProductSellerId('d0000000-0000-4000-8000-000000000001'), SONIDO);
    assert.equal(await repo.getProductSellerId('d0000000-0000-4000-8000-000000000099'), null);
    assert.equal((await repo.getSeller(SONIDO)).verified, true);
  });
});
