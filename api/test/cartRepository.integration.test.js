// Prova l'SQL de la cistella contra PostgreSQL amb els seeds carregats.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createCartRepository } from '../src/repositories/cartRepository.js';

const CLIENT = 'b0000000-0000-4000-8000-000000000001';
const ALTAVOZ = 'd0000000-0000-4000-8000-000000000001'; // 45 €/dia, fiança 150 €, Sonido Levante
const SILLA = 'd0000000-0000-4000-8000-000000000009'; // 3,50 €/dia, sense fiança, Mobiliario Turia
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('cartRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createCartRepository(pool);
  after(async () => {
    if (!pool) return;
    await pool.query(
      "DELETE FROM event_items WHERE event_id IN (SELECT id FROM events WHERE customer_id = $1 AND status IN ('draft', 'cancelled') AND starts_at >= '2031-01-01')",
      [CLIENT],
    );
    await pool.query("DELETE FROM events WHERE customer_id = $1 AND status IN ('draft', 'cancelled') AND starts_at >= '2031-01-01'", [CLIENT]);
    await pool.end();
  });

  const dates = (from, to) => ({ startsAt: new Date(from), endsAt: new Date(to) });

  it('un client té com a molt una cistella: desar dates dues vegades la reutilitza', async () => {
    const a = await repo.saveDates(CLIENT, dates('2031-05-01T10:00:00+02:00', '2031-05-02T10:00:00+02:00'));
    const b = await repo.saveDates(CLIENT, dates('2031-05-01T10:00:00+02:00', '2031-05-02T22:00:00+02:00'));
    assert.equal(a, b);
    assert.equal((await repo.findDraft(CLIENT)).endsAt.toISOString(), '2031-05-02T20:00:00.000Z');
  });

  it('agrupa per venedor i calcula subtotals i totals a SQL amb els dies facturables', async () => {
    const id = (await repo.findDraft(CLIENT)).id; // 36 h → 2 dies
    await repo.setItem(id, ALTAVOZ, 3);
    await repo.setItem(id, SILLA, 50);
    const cart = await repo.getCart(id);
    assert.equal(cart.billableDays, 2);
    assert.deepEqual(cart.sellers.map((g) => [g.seller.legalName, g.rentalSubtotal, g.depositSubtotal]), [
      ['Mobiliario Eventos Turia S.L.', '350.00', '0.00'],
      ['Sonido Levante S.L.', '270.00', '450.00'],
    ]);
    assert.deepEqual(cart.totals, { rental: '620.00', deposit: '450.00', toPay: '620.00' });
  });

  it('la línia guarda el preu del moment i el renova en tornar-la a desar', async () => {
    const id = (await repo.findDraft(CLIENT)).id;
    await pool.query('UPDATE products SET daily_price = 50 WHERE id = $1', [ALTAVOZ]);
    try {
      let item = (await repo.getCart(id)).sellers[1].items[0];
      assert.deepEqual([item.dailyPrice, item.currentDailyPrice], ['45.00', '50.00']);
      await repo.setItem(id, ALTAVOZ, 3);
      item = (await repo.getCart(id)).sellers[1].items[0];
      assert.equal(item.dailyPrice, '50.00');
    } finally {
      await pool.query('UPDATE products SET daily_price = 45 WHERE id = $1', [ALTAVOZ]);
    }
  });

  it('una cistella sense canvis durant més de 7 dies caduca', async () => {
    const { id } = await repo.findDraft(CLIENT);
    await pool.query("UPDATE events SET updated_at = now() - interval '6 days' WHERE id = $1", [id]);
    await repo.expireStale(CLIENT);
    assert.equal((await repo.findDraft(CLIENT)).id, id);
    await pool.query("UPDATE events SET updated_at = now() - interval '8 days' WHERE id = $1", [id]);
    await repo.expireStale(CLIENT);
    assert.equal(await repo.findDraft(CLIENT), null);
  });
});
