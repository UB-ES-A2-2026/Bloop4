// Prova la lectura i la confirmació de les reserves (fonaments del Sprint 2) contra PostgreSQL amb
// els seeds carregats.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createBookingRepository } from '../src/repositories/bookingRepository.js';
import { cleanup, createCustomers, createReadyCart, holdBooking } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006'; // Sonido Levante
const SEEDED = 'f0000000-0000-4000-8000-000000000001'; // reserva confirmada dels seeds
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('bookingRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createBookingRepository(pool);

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('llegeix una reserva amb el número i les dates; una cistella no és cap reserva', async () => {
    const booking = await repo.findBooking(SEEDED);
    assert.equal(booking.status, 'confirmed');
    assert.match(booking.bookingNumber, /^B4-\d{4}-\d{6}$/);
    assert.equal(booking.customerId, 'b0000000-0000-4000-8000-000000000001');
    assert.ok(booking.startsAt instanceof Date && booking.endsAt > booking.startsAt);

    const [customer] = await createCustomers(pool, 1, 'read');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-11-10' });
    assert.equal(await repo.findBooking(eventId), null);
    assert.equal(await repo.findBooking('f0000000-0000-4000-8000-000000000099'), null);
  });

  it('confirmar una reserva pendent la deixa confirmada i retorna els venedors a avisar', async () => {
    const [customer] = await createCustomers(pool, 1, 'ok');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-11-12' });
    await holdBooking(pool, eventId);
    const pending = await repo.findBooking(eventId);
    assert.equal(pending.status, 'pending_payment');
    assert.ok(pending.holdExpiresAt > new Date());

    const { booking, sellers } = await repo.confirm(eventId);
    assert.equal(booking.status, 'confirmed');
    assert.ok(booking.confirmedAt);
    assert.equal(booking.holdExpiresAt, null);
    assert.equal(booking.bookingNumber, pending.bookingNumber);
    assert.deepEqual(sellers.map((s) => [s.legalName, s.email]), [['Sonido Levante S.L.', 'sonido@example.com']]);
    // Una reserva que ja no està pendent no es torna a confirmar.
    assert.equal(await repo.confirm(eventId), null);
    assert.equal(await repo.confirm(SEEDED), null);
  });
});
