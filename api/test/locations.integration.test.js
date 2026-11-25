// Prova la ubicació del rider (US-16) contra PostgreSQL: només durant el lliurament en curs, només
// el rider assignat, freqüència, posició antiga i esborrat en acabar.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createLocationRepository } from '../src/repositories/locationRepository.js';
import { assignService, assignServices, cleanup, confirmBooking, createCustomers, createReadyCart, createRiders, setServiceStatus } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006';
const SILLA = 'd0000000-0000-4000-8000-000000000009';
const VALENCIA = { latitude: 39.469907, longitude: -0.376288, accuracy: 15 };
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('ubicació del rider (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const locations = skip ? null : createLocationRepository(pool);

  /** Reserva confirmada amb el lliurament i la recollida assignats al mateix rider (com si els hagués acceptat). */
  async function booking(day) {
    const [customer] = await createCustomers(pool, 1, 'loc');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day });
    await confirmBooking(pool, eventId);
    const [riderId] = await createRiders(pool, 1, 'van');
    return { eventId, riderId, ...(await assignServices(pool, eventId, riderId)) };
  }
  // El rider inicia el servei (US-09) o el completa (US-11): aquí es posa l'estat directament.
  const start = (serviceId) => setServiceStatus(pool, serviceId, 'in_transit');

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('només es comparteix amb el lliurament en curs: abans no surt res', async () => {
    const b = await booking('2033-05-10');
    await assert.rejects(locations.record(b.delivery, b.riderId, VALENCIA), (err) => err.details?.reason === 'NOT_IN_TRANSIT');
    assert.deepEqual(await locations.activeDeliveries(b.eventId), []);

    await start(b.delivery);
    let [active] = await locations.activeDeliveries(b.eventId);
    assert.equal(active.location, null);

    await locations.record(b.delivery, b.riderId, VALENCIA);
    [active] = await locations.activeDeliveries(b.eventId);
    assert.deepEqual([active.location.latitude, active.location.longitude, active.location.accuracy, active.location.stale], [39.469907, -0.376288, 15, false]);
    assert.equal(active.seller.legalName, 'Sonido Levante S.L.');
  });

  it('un altre rider no pot enviar la posició d\'un lliurament; una recollida no es comparteix', async () => {
    const b = await booking('2033-05-11');
    await start(b.delivery);
    const [other] = await createRiders(pool, 1, 'van');
    await assert.rejects(locations.record(b.delivery, other, VALENCIA), (err) => err.status === 404);
    await pool.query("UPDATE deliveries SET status = 'delivered' WHERE id = $1", [b.delivery]);
    await start(b.pickup);
    await assert.rejects(locations.record(b.pickup, b.riderId, VALENCIA), (err) => err.details?.reason === 'NOT_A_DELIVERY');
  });

  it('com a molt una posició cada 5 s; només es guarda l\'última', async () => {
    const b = await booking('2033-05-12');
    await start(b.delivery);
    await locations.record(b.delivery, b.riderId, VALENCIA);
    await assert.rejects(locations.record(b.delivery, b.riderId, VALENCIA), (err) => err.status === 429 && err.retryAfter > 0);
    await pool.query("UPDATE rider_locations SET recorded_at = now() - interval '6 seconds' WHERE delivery_id = $1", [b.delivery]);
    await locations.record(b.delivery, b.riderId, { latitude: 39.48, longitude: -0.37, accuracy: null });
    const { rows } = await pool.query('SELECT latitude, longitude FROM rider_locations WHERE delivery_id = $1', [b.delivery]);
    assert.deepEqual(rows.map((r) => [r.latitude, r.longitude]), [['39.480000', '-0.370000']]);
  });

  it('una posició de fa més de 2 minuts surt com a antiga', async () => {
    const b = await booking('2033-05-13');
    await start(b.delivery);
    await locations.record(b.delivery, b.riderId, VALENCIA);
    await pool.query("UPDATE rider_locations SET recorded_at = now() - interval '3 minutes' WHERE delivery_id = $1", [b.delivery]);
    assert.equal((await locations.activeDeliveries(b.eventId))[0].location.stale, true);
  });

  it('quan el lliurament acaba, la posició s\'esborra i deixa de sortir', async () => {
    const b = await booking('2033-05-14');
    await start(b.delivery);
    await locations.record(b.delivery, b.riderId, VALENCIA);
    await setServiceStatus(pool, b.delivery, 'delivered');
    assert.deepEqual(await locations.activeDeliveries(b.eventId), []);
    const { rows } = await pool.query('SELECT 1 FROM rider_locations WHERE delivery_id = $1', [b.delivery]);
    assert.equal(rows.length, 0);
  });

  it('amb diversos venedors, cada lliurament en curs té la seva posició', async () => {
    const [customer] = await createCustomers(pool, 1, 'loc-multi');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2033-05-15' });
    await pool.query('INSERT INTO event_items (event_id, product_id, quantity) VALUES ($1, $2, 1)', [eventId, SILLA]);
    await pool.query(
      `INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type)
       SELECT $1, 'a0000000-0000-4000-8000-000000000002', delivery_type, time_window, 'van' FROM deliveries WHERE event_id = $1`,
      [eventId],
    );
    await confirmBooking(pool, eventId);
    const { rows } = await pool.query("SELECT id FROM deliveries WHERE event_id = $1 AND delivery_type = 'delivery' ORDER BY seller_id", [eventId]);
    for (const [i, row] of rows.entries()) {
      const [riderId] = await createRiders(pool, 1, 'van');
      await assignService(pool, row.id, riderId);
      await start(row.id);
      await locations.record(row.id, riderId, { latitude: 39.4 + i / 100, longitude: -0.37, accuracy: 10 });
    }
    const active = await locations.activeDeliveries(eventId);
    assert.deepEqual(active.map((a) => [a.seller.legalName, a.location.latitude]), [
      ['Mobiliario Eventos Turia S.L.', 39.41],
      ['Sonido Levante S.L.', 39.4],
    ]);
  });
});
