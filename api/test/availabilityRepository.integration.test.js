// Prova la consulta de disponibilitat contra PostgreSQL amb els seeds (reserves del 15/06/2030).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createAvailabilityRepository } from '../src/repositories/availabilityRepository.js';

const ALTAVOZ = 'd0000000-0000-4000-8000-000000000001'; // 4 unitats, 3 reservades el 15/06 10:00 → 16/06 02:00
const JAIMA = 'd0000000-0000-4000-8000-000000000014'; // 2 unitats: 1 en manteniment i 1 reservada 14/06 → 17/06
const SILLA = 'd0000000-0000-4000-8000-000000000009'; // 100 unitats
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('availabilityRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createAvailabilityRepository(pool);
  const createdItems = [];
  after(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM event_item_units WHERE event_item_id = ANY($1::uuid[])', [createdItems]);
    await pool.query('DELETE FROM event_items WHERE id = ANY($1::uuid[])', [createdItems]);
    await pool.end();
  });

  const check = (id, from, to) => repo.check(id, { from: new Date(from), to: new Date(to) });

  /** Reserva `units` unitats del producte en [from, to) dins de l'esdeveniment confirmat dels seeds. */
  async function reserve(productId, units, from, to) {
    const { rows } = await pool.query(
      `INSERT INTO event_items (event_id, product_id, quantity)
       VALUES ('f0000000-0000-4000-8000-000000000001', $1, $2)
       ON CONFLICT (event_id, product_id) DO UPDATE SET quantity = event_items.quantity + $2
       RETURNING id`,
      [productId, units],
    );
    createdItems.push(rows[0].id);
    await pool.query(
      `INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
       SELECT $1, u.id, tstzrange($3, $4, '[)')
       FROM product_units u WHERE u.product_id = $2 AND u.status = 'available'
       ORDER BY u.id DESC LIMIT $5`,
      [rows[0].id, productId, from, to, units],
    );
    return rows[0].id;
  }

  it('compta les unitats lliures durant una reserva', async () => {
    const r = await check(ALTAVOZ, '2030-06-15T18:00:00+02:00', '2030-06-15T23:00:00+02:00');
    assert.deepEqual(r, { availableUnits: 1, totalUnits: 4, billableDays: 1, totalPrice: '45.00', currency: 'EUR' });
  });

  it('aplica el marge de preparació de 2 h després de la reserva (que acaba a les 02:00)', async () => {
    assert.equal((await check(ALTAVOZ, '2030-06-16T03:59:00+02:00', '2030-06-16T12:00:00+02:00')).availableUnits, 1);
    assert.equal((await check(ALTAVOZ, '2030-06-16T04:00:00+02:00', '2030-06-16T12:00:00+02:00')).availableUnits, 4);
  });

  it('i també abans: acabar 2 h abans que comenci la reserva ja no se solapa', async () => {
    assert.equal((await check(ALTAVOZ, '2030-06-15T06:00:00+02:00', '2030-06-15T08:00:00+02:00')).availableUnits, 4);
    assert.equal((await check(ALTAVOZ, '2030-06-15T06:00:00+02:00', '2030-06-15T08:01:00+02:00')).availableUnits, 1);
  });

  it('sense marge, una reserva que acaba quan comença una altra no se solapa ([inici, fi))', async () => {
    await pool.query("UPDATE sellers SET prep_margin = interval '0' WHERE id = 'a0000000-0000-4000-8000-000000000001'");
    try {
      assert.equal((await check(ALTAVOZ, '2030-06-16T02:00:00+02:00', '2030-06-16T05:00:00+02:00')).availableUnits, 4);
      assert.equal((await check(ALTAVOZ, '2030-06-16T01:59:00+02:00', '2030-06-16T05:00:00+02:00')).availableUnits, 1);
    } finally {
      await pool.query("UPDATE sellers SET prep_margin = interval '2 hours' WHERE id = 'a0000000-0000-4000-8000-000000000001'");
    }
  });

  it('les reserves cancel·lades i les unitats en manteniment no compten', async () => {
    assert.equal((await check(ALTAVOZ, '2030-06-22T12:00:00+02:00', '2030-06-23T00:00:00+02:00')).availableUnits, 4);
    const jaima = await check(JAIMA, '2030-06-15T12:00:00+02:00', '2030-06-16T00:00:00+02:00');
    assert.deepEqual([jaima.availableUnits, jaima.totalUnits], [0, 1]);
  });

  it('dies facturables: blocs de 24 h arrodonits a l\'alça, mínim 1', async () => {
    assert.equal((await check(ALTAVOZ, '2030-07-01T10:00:00+02:00', '2030-07-01T12:00:00+02:00')).billableDays, 1);
    assert.equal((await check(ALTAVOZ, '2030-07-01T10:00:00+02:00', '2030-07-02T10:00:00+02:00')).billableDays, 1);
    const r = await check(ALTAVOZ, '2030-07-01T10:00:00+02:00', '2030-07-02T10:01:00+02:00');
    assert.deepEqual([r.billableDays, r.totalPrice], [2, '90.00']);
  });

  it('canvi d\'hora d\'hivern (27/10/2030): els intervals són instants absoluts', async () => {
    // De dissabte 12:00 a diumenge 12:00 hora local hi ha 25 h reals → 2 blocs de 24 h.
    assert.equal((await check(SILLA, '2030-10-26T12:00:00+02:00', '2030-10-27T12:00:00+01:00')).billableDays, 2);
    // Una reserva de 01:30 (+02:00) a 02:30 (+01:00) dura 2 h i bloqueja tota la franja repetida.
    await reserve(SILLA, 100, '2030-10-27T01:30:00+02:00', '2030-10-27T02:30:00+01:00');
    assert.equal((await check(SILLA, '2030-10-27T02:15:00+01:00', '2030-10-27T02:20:00+01:00')).availableUnits, 0);
    assert.equal((await check(SILLA, '2030-10-27T04:30:00+01:00', '2030-10-27T06:00:00+01:00')).availableUnits, 100);
  });

  it('el calendari marca els dies (hora de Madrid) sense cap unitat lliure', async () => {
    assert.deepEqual(await repo.unavailableDays(JAIMA, '2030-06'), ['2030-06-14', '2030-06-15', '2030-06-16', '2030-06-17']);
    assert.deepEqual(await repo.unavailableDays(ALTAVOZ, '2030-06'), []);
    assert.equal(await repo.unavailableDays('d0000000-0000-4000-8000-000000000099', '2030-06'), null);
  });

  it('rendiment: amb 2000 reserves, la consulta p95 < 200 ms', async () => {
    const itemId = await reserve(SILLA, 1, '2031-01-01T10:00:00+01:00', '2031-01-01T12:00:00+01:00');
    // 20 reserves per unitat (2000 en total) repartides al llarg del 2031.
    await pool.query(
      `INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
       SELECT $1, u.id, tstzrange(t, t + interval '6 hours', '[)')
       FROM product_units u
       CROSS JOIN generate_series(timestamptz '2031-02-01', timestamptz '2031-02-01' + interval '19 weeks', interval '1 week') AS t
       WHERE u.product_id = $2 AND u.status = 'available'`,
      [itemId, SILLA],
    );
    const times = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await check(SILLA, `2031-03-${String((i % 20) + 1).padStart(2, '0')}T10:00:00+01:00`, '2031-03-28T10:00:00+01:00');
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    assert.ok(p95 < 200, `p95 = ${p95.toFixed(1)} ms`);
  });
});
