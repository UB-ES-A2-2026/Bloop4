// Prova la llista de serveis del rider (US-15) contra PostgreSQL: dia en hora de Madrid, ordre,
// estat buit, serveis d'altres riders i canvis després d'acceptar. El detall d'un servei
// (`riderRepository.findMine`) és dels fonaments i té la seva prova.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createRiderScheduleRepository } from '../src/repositories/riderScheduleRepository.js';
import { assignServices, cleanup, confirmBooking, createCustomers, createReadyCart, createRiders } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006';
const SEED_RIDER = 'b0000000-0000-4000-8000-000000000004';
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('riderScheduleRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const schedule = skip ? null : createRiderScheduleRepository(pool);

  /** Reserva confirmada amb el lliurament i la recollida assignats al rider (com si els hagués acceptat). */
  async function acceptedServices(day, rider) {
    const [customer] = await createCustomers(pool, 1, 'sched');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day });
    await confirmBooking(pool, eventId);
    return assignServices(pool, eventId, rider.userId);
  }

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('el rider dels seeds veu els serveis del dia per ordre d\'hora, també el cancel·lat', async () => {
    const services = await schedule.servicesOn(SEED_RIDER, '2030-06-15');
    assert.deepEqual(services.map((s) => [s.type, s.status, s.seller.legalName]), [
      ['delivery', 'assigned', 'Sonido Levante S.L.'],
      ['delivery', 'cancelled', 'Mobiliario Eventos Turia S.L.'],
    ]);
    assert.equal(services[0].address.street, 'Calle Ficticia 1');
    assert.equal(services[0].address.accessInstructions, 'Portón verde, preguntar por la organizadora');
    assert.deepEqual(services[0].items, [
      { eventItemId: 'f1000000-0000-4000-8000-000000000001', name: 'Altavoz activo 12" 1300 W', quantity: 3 },
    ]);
    assert.deepEqual(await schedule.servicesOn(SEED_RIDER, '2030-06-18'), []);
  });

  it('marca els serveis modificats o cancel·lats després d\'acceptar-los', async () => {
    const byType = Object.fromEntries((await schedule.servicesOn(SEED_RIDER, '2030-06-16')).map((s) => [s.type, s]));
    assert.equal(byType.pickup.changedSinceAssigned, true);
    assert.equal((await schedule.servicesOn(SEED_RIDER, '2030-06-14'))[0].changedSinceAssigned, false);

    const [userId] = await createRiders(pool, 1, 'van');
    const { delivery } = await acceptedServices('2033-02-10', { userId, vehicleType: 'van' });
    await pool.query("UPDATE deliveries SET status = 'cancelled' WHERE id = $1", [delivery]);
    const [cancelled] = await schedule.servicesOn(userId, '2033-02-10');
    assert.deepEqual([cancelled.id, cancelled.status, cancelled.changedSinceAssigned], [delivery, 'cancelled', true]);
  });

  it('el dia es compta en hora de Madrid: un servei a les 00:30 és del dia que comença', async () => {
    const [userId] = await createRiders(pool, 1, 'van');
    const rider = { userId, vehicleType: 'van' };
    const { delivery } = await acceptedServices('2033-02-11', rider);
    await pool.query(
      "UPDATE deliveries SET time_window = tstzrange('2033-02-12 00:30 Europe/Madrid', '2033-02-12 02:30 Europe/Madrid', '[)') WHERE id = $1",
      [delivery],
    );
    // El 12/02 també hi ha la recollida (10:00): el lliurament mogut hi surt primer.
    assert.equal((await schedule.servicesOn(userId, '2033-02-12'))[0].id, delivery);
    assert.equal((await schedule.servicesOn(userId, '2033-02-11')).some((s) => s.id === delivery), false);
  });

  it('un rider no veu els serveis d\'un altre', async () => {
    const [mine, other] = await createRiders(pool, 2, 'van');
    const { delivery } = await acceptedServices('2033-02-13', { userId: mine, vehicleType: 'van' });
    assert.deepEqual(await schedule.servicesOn(other, '2033-02-13'), []);
    assert.equal((await schedule.servicesOn(mine, '2033-02-13'))[0].id, delivery);
  });

  it('els propers serveis són els actius que encara no han acabat', async () => {
    const [userId] = await createRiders(pool, 1, 'van');
    const { delivery, pickup } = await acceptedServices('2033-02-14', { userId, vehicleType: 'van' });
    await pool.query("UPDATE deliveries SET status = 'cancelled' WHERE id = $1", [pickup]);
    assert.deepEqual((await schedule.upcoming(userId)).map((s) => s.id), [delivery]);
  });
});
