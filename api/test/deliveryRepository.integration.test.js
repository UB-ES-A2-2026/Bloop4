// Prova l'SQL del lliurament contra PostgreSQL amb els seeds carregats.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createCartRepository } from '../src/repositories/cartRepository.js';
import { createDeliveryRepository } from '../src/repositories/deliveryRepository.js';

const CLIENT = 'b0000000-0000-4000-8000-000000000001';
const SONIDO = 'a0000000-0000-4000-8000-000000000001';
const ALTAVOZ = 'd0000000-0000-4000-8000-000000000001'; // 18 kg, 62×38×35 cm
const MESA = 'd0000000-0000-4000-8000-000000000011'; // 28 kg, 180×180×74 cm (2,4 m³)
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('deliveryRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const carts = skip ? null : createCartRepository(pool);
  const repo = skip ? null : createDeliveryRepository(pool);
  let eventId;

  after(async () => {
    if (!pool) return;
    if (eventId) {
      for (const table of ['deliveries', 'event_transport', 'event_items']) {
        await pool.query(`DELETE FROM ${table} WHERE event_id = $1`, [eventId]);
      }
      const { rows } = await pool.query('SELECT address_id FROM events WHERE id = $1', [eventId]);
      await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
      if (rows[0]?.address_id) await pool.query('DELETE FROM addresses WHERE id = $1', [rows[0].address_id]);
    }
    await pool.end();
  });

  it('prepara una cistella amb productes dels dos venedors', async () => {
    eventId = await carts.saveDates(CLIENT, { startsAt: new Date('2031-06-14T10:00:00+02:00'), endsAt: new Date('2031-06-14T23:00:00+02:00') });
    await carts.setItem(eventId, ALTAVOZ, 2);
    await carts.setItem(eventId, MESA, 1);
  });

  it('cobertura: València per a tots dos; Paterna només per a Sonido Levante', async () => {
    assert.deepEqual(await repo.uncoveredSellers(eventId, '46001'), []);
    assert.deepEqual((await repo.uncoveredSellers(eventId, '46980')).map((s) => s.legalName), ['Mobiliario Eventos Turia S.L.']);
  });

  it('el vehicle depèn del pes i el volum de cada venedor', async () => {
    const loads = await repo.loads(eventId);
    assert.deepEqual(loads.map((l) => [l.seller.legalName, l.weightKg, l.volumeM3, l.vehicle.type, l.price]), [
      ['Mobiliario Eventos Turia S.L.', '28.00', '2.398', 'van', '45.00'],
      ['Sonido Levante S.L.', '36.00', '0.165', 'car', '25.00'],
    ]);
  });

  it('franges de 2 h de 08:00 a 22:00 (hora de Madrid); una plena si el venedor ja no té capacitat', async () => {
    let slots = await repo.slots(eventId, '2030-06-15');
    assert.equal(slots.length, 7);
    assert.equal(slots[0].startsAt.toISOString(), '2030-06-15T06:00:00.000Z');
    assert.ok(slots.every((s) => s.hasCapacity));
    // Sonido ja té un lliurament confirmat el 15/06 de 08:00 a 10:00 (seeds).
    await pool.query('UPDATE sellers SET delivery_capacity = 1 WHERE id = $1', [SONIDO]);
    try {
      slots = await repo.slots(eventId, '2030-06-15');
      assert.deepEqual(slots.map((s) => s.hasCapacity), [false, true, true, true, true, true, true]);
    } finally {
      await pool.query('UPDATE sellers SET delivery_capacity = 3 WHERE id = $1', [SONIDO]);
    }
  });

  it('desa l\'adreça, un lliurament i una recollida per venedor i el preu del transport', async () => {
    await repo.saveDelivery(eventId, CLIENT, {
      address: { street: 'Calle Ficticia 3', postalCode: '46001', city: 'Valencia', accessInstructions: null },
      deliveryWindow: { startsAt: new Date('2031-06-14T08:00:00+02:00'), endsAt: new Date('2031-06-14T10:00:00+02:00') },
      pickupWindow: { startsAt: new Date('2031-06-15T10:00:00+02:00'), endsAt: new Date('2031-06-15T12:00:00+02:00') },
    });
    const delivery = await repo.getDelivery(eventId);
    assert.equal(delivery.address.street, 'Calle Ficticia 3');
    assert.equal(delivery.transportTotal, '70.00');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM deliveries WHERE event_id = $1', [eventId]);
    assert.equal(rows[0].n, 4);
  });

  it('si la cistella canvia, el transport es recalcula en llegir-lo', async () => {
    await carts.setItem(eventId, MESA, 4); // 9,6 m³: ja no cap a la furgoneta
    const delivery = await repo.getDelivery(eventId);
    assert.deepEqual(delivery.transport.map((t) => t.vehicle.type), ['truck', 'car']);
    assert.equal(delivery.transportTotal, '115.00');
    assert.equal(await repo.addAmounts('300.00', delivery.transportTotal), '415.00');
  });

  it('les cistelles (draft) no ocupen capacitat de les franges', async () => {
    await pool.query('UPDATE sellers SET delivery_capacity = 1 WHERE id = $1', [SONIDO]);
    try {
      const slots = await repo.slots(eventId, '2031-06-14');
      assert.equal(slots[0].hasCapacity, true);
    } finally {
      await pool.query('UPDATE sellers SET delivery_capacity = 3 WHERE id = $1', [SONIDO]);
    }
  });
});
