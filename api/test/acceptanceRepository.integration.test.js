// Prova l'acceptació de serveis (US-14) contra PostgreSQL: concurrència entre riders, capacitat
// del vehicle, horaris solapats i privacitat de les dades del client.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createAcceptanceRepository } from '../src/repositories/acceptanceRepository.js';
import { createRiderRepository } from '../src/repositories/riderRepository.js';
import { cleanup, confirmBooking, createCustomers, createReadyCart, createRiders } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006'; // Sonido Levante
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('acceptanceRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createAcceptanceRepository(pool);
  const riders = skip ? null : createRiderRepository(pool);
  const van = async () => ({ userId: (await createRiders(pool, 1, 'van'))[0], vehicleType: 'van' });

  /** Reserva confirmada amb un lliurament i una recollida (vehicle `vehicle`). @returns ids dels serveis */
  async function confirmedServices(day, vehicle = 'van') {
    const [customer] = await createCustomers(pool, 1, 'svc');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day });
    await confirmBooking(pool, eventId);
    await pool.query('UPDATE deliveries SET vehicle_type = $2 WHERE event_id = $1', [eventId, vehicle]);
    const { rows } = await pool.query('SELECT id, delivery_type FROM deliveries WHERE event_id = $1', [eventId]);
    return Object.fromEntries(rows.map((r) => [r.delivery_type, r.id]));
  }

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('20 riders accepten alhora el mateix servei: només un se\'l queda', async () => {
    const { delivery } = await confirmedServices('2033-01-10');
    const riders = await createRiders(pool, 20, 'van');
    const results = await Promise.allSettled(riders.map((userId) => repo.accept(delivery, { userId, vehicleType: 'van' })));
    const won = results.filter((r) => r.status === 'fulfilled');
    assert.equal(won.length, 1);
    for (const lost of results.filter((r) => r.status === 'rejected')) {
      assert.equal(lost.reason.status, 409);
      assert.equal(lost.reason.details.reason, 'TAKEN');
    }
    const { rows } = await pool.query('SELECT status, rider_id FROM deliveries WHERE id = $1', [delivery]);
    assert.equal(rows[0].status, 'assigned');
    assert.equal(rows[0].rider_id, riders[results.indexOf(won[0])]);
  });

  it('la llista de disponibles no porta dades personals; el servei acceptat, sí', async () => {
    const { delivery } = await confirmedServices('2033-01-11');
    const rider = await van();
    const listed = (await repo.availableServices(rider)).find((s) => s.id === delivery);
    assert.deepEqual(listed.zone, { postalCode: '46001', city: 'Valencia' });
    assert.deepEqual(listed.items, [{ name: 'Foco PAR LED RGBW 18x10 W', quantity: 1 }]);
    for (const field of ['address', 'customer', 'bookingNumber']) assert.equal(listed[field], undefined, field);
    assert.doesNotMatch(JSON.stringify(listed), /Calle de Prueba|Cliente de prueba/);

    const accepted = await repo.accept(delivery, rider);
    assert.equal(accepted.address.street, 'Calle de Prueba 1');
    assert.match(accepted.customer.fullName, /^Cliente de prueba/);
    // Ja no surt com a disponible.
    assert.equal((await repo.availableServices(rider)).some((s) => s.id === delivery), false);
    // Acceptar-lo una altra vegada no és un error; un altre rider rep 409.
    assert.equal((await repo.accept(delivery, rider)).id, delivery);
    await assert.rejects(repo.accept(delivery, await van()), (err) => err.details?.reason === 'TAKEN');
  });

  it('el lliurament i la recollida d\'una reserva poden ser de riders diferents', async () => {
    const { delivery, pickup } = await confirmedServices('2033-01-12');
    const a = await van();
    const b = await van();
    assert.equal((await repo.accept(delivery, a)).status, 'assigned');
    assert.equal((await repo.accept(pickup, b)).status, 'assigned');
  });

  it('un vehicle petit no pot acceptar un servei que necessita furgoneta', async () => {
    const { delivery } = await confirmedServices('2033-01-13', 'van');
    const [bike] = await createRiders(pool, 1, 'cargo_bike');
    const rider = { userId: bike, vehicleType: 'cargo_bike' };
    assert.equal((await repo.availableServices(rider)).find((s) => s.id === delivery).fitsVehicle, false);
    await assert.rejects(repo.accept(delivery, rider), (err) => err.status === 409 && err.details.reason === 'VEHICLE_TOO_SMALL');
    const [truck] = await createRiders(pool, 1, 'truck');
    assert.equal((await repo.accept(delivery, { userId: truck, vehicleType: 'truck' })).status, 'assigned');
  });

  it('un rider no pot acceptar dos serveis que se solapen, ni tan sols alhora', async () => {
    const first = await confirmedServices('2033-01-14');
    const second = await confirmedServices('2033-01-14'); // mateixa franja: 08:00–10:00
    const rider = await van();
    await repo.accept(first.delivery, rider);
    assert.equal((await repo.availableServices(rider)).find((s) => s.id === second.delivery).scheduleConflict, true);
    await assert.rejects(repo.accept(second.delivery, rider), (err) => err.details?.reason === 'SCHEDULE_CONFLICT');

    const third = await confirmedServices('2033-01-15');
    const fourth = await confirmedServices('2033-01-15');
    const other = await van();
    const results = await Promise.allSettled([repo.accept(third.delivery, other), repo.accept(fourth.delivery, other)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.details.reason, 'SCHEDULE_CONFLICT');
  });

  it('només surten serveis de reserves confirmades i futures', async () => {
    const [customer] = await createCustomers(pool, 1, 'draft');
    const draftEvent = await createReadyCart(pool, customer, { productId: FOCO, day: '2033-01-16' });
    const rider = await van();
    const ids = (await repo.availableServices(rider)).map((s) => s.id);
    const { rows } = await pool.query('SELECT id FROM deliveries WHERE event_id = $1', [draftEvent]);
    assert.equal(rows.some((r) => ids.includes(r.id)), false);
    await assert.rejects(repo.accept(rows[0].id, rider), (err) => err.details?.reason === 'TAKEN');
  });

  it('un administrador converteix un compte actiu en rider; dues vegades, 409', async () => {
    const [userId] = await createCustomers(pool, 1, 'nou-rider');
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const created = await repo.createRider(rows[0].email, 'car');
    assert.deepEqual([created.userId, created.vehicleType], [userId, 'car']);
    assert.deepEqual(await riders.findRider(userId), { userId, vehicleType: 'car' });
    await assert.rejects(repo.createRider(rows[0].email, 'car'), (err) => err.status === 409);
    await assert.rejects(repo.createRider('ningu@test.invalid', 'car'), (err) => err.status === 404);
    await assert.rejects(repo.createRider(rows[0].email, 'helicoptero'), (err) => err.status === 400);
  });
});
