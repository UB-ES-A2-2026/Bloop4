// Prova l'SQL real contra una base de dades amb la migració i els seeds carregats.
// S'omet si no hi ha DATABASE_URL:
//   DATABASE_URL=postgres://eventrent:eventrent@localhost:5432/eventrent npm test
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createCatalogRepository } from '../src/repositories/catalogRepository.js';

const SONIDO = 'c0000000-0000-4000-8000-000000000001';
const MICROFONIA = 'c0000000-0000-4000-8000-000000000004';
const SILLAS = 'c0000000-0000-4000-8000-000000000010';

const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('catalogRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createCatalogRepository(pool);
  after(() => pool?.end());

  const list = (categoryIds, limit = 100, offset = 0) => repo.listProducts({ categoryIds, limit, offset });

  it('llista les 14 categories amb recomptes que sumen els 15 productes', async () => {
    const categories = await repo.listCategories();
    assert.equal(categories.length, 14);
    assert.equal(categories.reduce((sum, c) => sum + c.productCount, 0), 15);
  });

  it('un pare inclou les seves descendents i una fulla només ella mateixa', async () => {
    assert.equal((await list([SONIDO])).totalItems, 5);
    assert.equal((await list([MICROFONIA])).totalItems, 2);
    assert.equal((await list([SONIDO, SILLAS])).totalItems, 7);
    assert.equal((await list(null)).totalItems, 15);
  });

  it('pagina sense repetir ni saltar productes', async () => {
    const all = (await list(null)).items.map((p) => p.id);
    const pages = [];
    for (let offset = 0; offset < all.length; offset += 4) pages.push(...(await list(null, 4, offset)).items.map((p) => p.id));
    assert.deepEqual(pages, all);
  });

  it('retorna el preu com a string decimal i les dades del venedor', async () => {
    const [silla] = (await list([SILLAS])).items.filter((p) => p.name === 'Silla Tiffany blanca');
    assert.equal(silla.dailyPrice, '3.50');
    assert.equal(silla.seller.legalName, 'Mobiliario Eventos Turia S.L.');
    assert.equal(silla.seller.city, 'Valencia');
    assert.equal(silla.parentCategory.slug, 'mobiliario');
  });
});
