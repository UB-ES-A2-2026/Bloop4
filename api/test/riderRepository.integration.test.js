// Prova el perfil del rider i com veu un servei seu (fonaments del Sprint 2) contra PostgreSQL amb
// els seeds carregats.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createRiderRepository } from '../src/repositories/riderRepository.js';
import { assignServices, cleanup, confirmBooking, createCustomers, createReadyCart, createRiders } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006';
const SEED_RIDER = 'b0000000-0000-4000-8000-000000000004';
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('riderRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createRiderRepository(pool);

  /** Servei de lliurament d'una reserva confirmada nova, assignat al rider. */
  async function assignedDelivery(day, riderId) {
    const [customer] = await createCustomers(pool, 1, 'mine');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, quantity: 2, day });
    await confirmBooking(pool, eventId);
    return (await assignServices(pool, eventId, riderId, { types: ['delivery'] })).delivery;
  }

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('el perfil del rider té el vehicle; un usuari sense perfil de rider no en té', async () => {
    assert.deepEqual(await repo.findRider(SEED_RIDER), { userId: SEED_RIDER, vehicleType: 'van' });
    assert.equal(await repo.findRider('b0000000-0000-4000-8000-000000000001'), null);
  });

  it('el rider veu un servei seu amb les dades del client i l\'id de cada línia', async () => {
    const [riderId] = await createRiders(pool, 1, 'van');
    const delivery = await assignedDelivery('2033-03-10', riderId);
    const service = await repo.findMine(delivery, riderId);
    assert.deepEqual([service.id, service.type, service.status], [delivery, 'delivery', 'assigned']);
    assert.match(service.bookingNumber, /^B4-\d{4}-\d{6}$/);
    assert.deepEqual(service.address, { street: 'Calle de Prueba 1', postalCode: '46001', city: 'Valencia', accessInstructions: null });
    assert.match(service.customer.fullName, /^Cliente de prueba/);
    assert.equal(service.items.length, 1);
    assert.deepEqual([service.items[0].name, service.items[0].quantity], ['Foco PAR LED RGBW 18x10 W', 2]);
    assert.ok(service.items[0].eventItemId);
    assert.equal(service.changedSinceAssigned, false);
  });

  it('un canvi de franja o d\'estat després d\'acceptar-lo marca el servei com a modificat', async () => {
    const [riderId] = await createRiders(pool, 1, 'van');
    const delivery = await assignedDelivery('2033-03-11', riderId);
    await pool.query("UPDATE deliveries SET time_window = tstzrange(lower(time_window) + interval '1 hour', upper(time_window) + interval '1 hour', '[)') WHERE id = $1", [delivery]);
    assert.equal((await repo.findMine(delivery, riderId)).changedSinceAssigned, true);
    await pool.query("UPDATE deliveries SET status = 'cancelled' WHERE id = $1", [delivery]);
    assert.equal((await repo.findMine(delivery, riderId)).status, 'cancelled');
  });

  it('un rider no veu els serveis d\'un altre', async () => {
    const [mine, other] = await createRiders(pool, 2, 'van');
    const delivery = await assignedDelivery('2033-03-12', mine);
    assert.equal(await repo.findMine(delivery, other), null);
    assert.equal((await repo.findMine(delivery, mine)).id, delivery);
  });
});
