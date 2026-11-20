// Prova el checkout (US-12) contra PostgreSQL amb els seeds carregats: concurrència, idempotència i
// expiració dels bloquejos. Llegir i confirmar una reserva és dels fonaments (bookingRepository).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createCheckoutRepository, HOLD_MINUTES, MAX_PENDING_BOOKINGS } from '../src/repositories/checkoutRepository.js';
import { createBookingRepository } from '../src/repositories/bookingRepository.js';
import { cleanup, confirmBooking, createCustomers, createReadyCart } from '../test-support/bookingFixtures.js';

const JAIMA = 'd0000000-0000-4000-8000-000000000014'; // 2 unitats, 1 en manteniment → 1 de lliure
const FOCO = 'd0000000-0000-4000-8000-000000000006'; // 12 unitats, Sonido Levante
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';
let keys = 0;
const key = () => ({ idempotencyKey: `test-key-${++keys}-${Date.now()}` });

describe('checkoutRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createCheckoutRepository(pool);
  const bookings = skip ? null : createBookingRepository(pool);
  const activeUnits = async (eventId) =>
    (await pool.query(
      'SELECT count(*)::int AS n FROM event_item_units r JOIN event_items ei ON ei.id = r.event_item_id WHERE ei.event_id = $1 AND r.is_active',
      [eventId],
    )).rows[0].n;
  const statusOf = async (eventId) => (await pool.query('SELECT status FROM events WHERE id = $1', [eventId])).rows[0].status;

  before(async () => { if (pool) await cleanup(pool); });
  after(async () => {
    if (!pool) return;
    await cleanup(pool);
    await pool.end();
  });

  it('100 clients confirmen alhora l\'última unitat: exactament 1 ho aconsegueix i cap unitat queda duplicada', async () => {
    const customers = await createCustomers(pool, 100, 'race');
    for (const id of customers) await createReadyCart(pool, id, { productId: JAIMA, day: '2031-03-10' });

    const results = await Promise.allSettled(customers.map((id) => repo.checkout(id, key())));
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    assert.equal(won.length, 1);
    assert.equal(lost.length, 99);
    for (const { reason } of lost) {
      assert.equal(reason.status, 409, reason.message);
      assert.equal(reason.details.reason, 'UNAVAILABLE');
      assert.match(reason.message, /ya no está disponible/);
    }
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM event_item_units r JOIN product_units u ON u.id = r.unit_id
       WHERE u.product_id = $1 AND r.is_active AND r.reserved_period && tstzrange('2031-03-09', '2031-03-12')`,
      [JAIMA],
    );
    assert.equal(rows[0].n, 1);
  });

  it('el checkout deixa la reserva pendent 15 minuts, amb número i unitats de tot l\'interval logístic', async () => {
    const [customer] = await createCustomers(pool, 1, 'hold');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, quantity: 3, day: '2031-04-10' });
    const { id, created } = await repo.checkout(customer, key());
    assert.deepEqual([id, created], [eventId, true]);

    const booking = await bookings.findBooking(eventId);
    assert.equal(booking.status, 'pending_payment');
    assert.match(booking.bookingNumber, /^B4-\d{4}-\d{6}$/);
    const minutes = (booking.holdExpiresAt - Date.now()) / 60_000;
    assert.ok(minutes > HOLD_MINUTES - 1 && minutes <= HOLD_MINUTES, `bloqueig de ${minutes} min`);

    const { rows } = await pool.query(
      `SELECT DISTINCT lower(r.reserved_period) AS from, upper(r.reserved_period) AS to, count(*) OVER ()::int AS n
       FROM event_item_units r JOIN event_items ei ON ei.id = r.event_item_id WHERE ei.event_id = $1 AND r.is_active`,
      [eventId],
    );
    assert.equal(rows[0].n, 3);
    // Del principi del lliurament (10/04 08:00) al final de la recollida (11/04 12:00), hora de Madrid.
    assert.equal(rows[0].from.toISOString(), '2031-04-10T06:00:00.000Z');
    assert.equal(rows[0].to.toISOString(), '2031-04-11T10:00:00.000Z');
  });

  it('repetir el checkout amb la mateixa Idempotency-Key retorna la mateixa reserva sense duplicar unitats', async () => {
    const [customer] = await createCustomers(pool, 1, 'idem');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, quantity: 2, day: '2031-04-20' });
    const same = key();
    const [a, b] = await Promise.all([repo.checkout(customer, same), repo.checkout(customer, same)]);
    assert.equal(a.id, eventId);
    assert.equal(b.id, eventId);
    assert.deepEqual([a.created, b.created].sort(), [false, true]);
    assert.deepEqual(await repo.checkout(customer, same), { id: eventId, created: false });
    assert.equal(await activeUnits(eventId), 2);
  });

  it('un bloqueig caducat allibera les unitats i la reserva torna a ser la cistella', async () => {
    const [customer] = await createCustomers(pool, 1, 'exp');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, quantity: 2, day: '2031-05-10' });
    await repo.checkout(customer, key());
    assert.equal(await repo.releaseExpiredHolds(customer), 0);

    await pool.query("UPDATE events SET hold_expires_at = now() - interval '1 second' WHERE id = $1", [eventId]);
    assert.equal(await repo.releaseExpiredHolds(customer), 1);
    assert.equal(await statusOf(eventId), 'draft');
    assert.equal(await activeUnits(eventId), 0);
    assert.equal(await bookings.findBooking(eventId), null);
    const { rows } = await pool.query('SELECT hold_expired_at, checkout_key FROM events WHERE id = $1', [eventId]);
    assert.ok(rows[0].hold_expired_at);
    assert.equal(rows[0].checkout_key, null);

    // Es pot tornar a confirmar: les mateixes unitats tornen a estar lliures.
    assert.equal((await repo.checkout(customer, key())).created, true);
    assert.equal(await activeUnits(eventId), 2);
  });

  it('el checkout allibera primer els bloquejos caducats d\'altres clients', async () => {
    const [first, second] = await createCustomers(pool, 2, 'free');
    const held = await createReadyCart(pool, first, { productId: JAIMA, day: '2031-06-10' });
    await createReadyCart(pool, second, { productId: JAIMA, day: '2031-06-10' });
    await repo.checkout(first, key());
    await assert.rejects(repo.checkout(second, key()), (err) => err.details?.reason === 'UNAVAILABLE');

    await pool.query("UPDATE events SET hold_expires_at = now() - interval '1 second' WHERE id = $1", [held]);
    assert.equal((await repo.checkout(second, key())).created, true);
    assert.equal(await statusOf(held), 'draft');
  });

  it('revalida la cistella: preu canviat, producte retirat i franja fora de termini', async () => {
    const [customer] = await createCustomers(pool, 1, 'reval');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-07-10' });

    await pool.query('UPDATE products SET daily_price = daily_price + 1 WHERE id = $1', [FOCO]);
    try {
      await assert.rejects(repo.checkout(customer, key()), (err) => {
        assert.equal(err.details.reason, 'CART_CHANGED');
        assert.deepEqual(err.details.products.map((p) => p.id), [FOCO]);
        return true;
      });
    } finally {
      await pool.query('UPDATE products SET daily_price = daily_price - 1 WHERE id = $1', [FOCO]);
    }

    await pool.query("UPDATE products SET status = 'draft' WHERE id = $1", [FOCO]);
    try {
      await assert.rejects(repo.checkout(customer, key()), (err) => err.details?.reason === 'CART_CHANGED');
    } finally {
      await pool.query("UPDATE products SET status = 'published' WHERE id = $1", [FOCO]);
    }

    // La recollida comença abans que acabi l'esdeveniment.
    await pool.query("UPDATE events SET ends_at = ends_at + interval '2 days' WHERE id = $1", [eventId]);
    await assert.rejects(repo.checkout(customer, key()), (err) => err.details?.reason === 'DELIVERY_INVALID');
    assert.equal(await statusOf(eventId), 'draft');
    assert.equal(await activeUnits(eventId), 0);
  });

  it('sense lliurament desat o amb la cistella buida no es pot confirmar', async () => {
    const [customer] = await createCustomers(pool, 1, 'empty');
    await assert.rejects(repo.checkout(customer, key()), (err) => err.details?.reason === 'EMPTY');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-07-20' });
    await pool.query('DELETE FROM deliveries WHERE event_id = $1', [eventId]);
    await assert.rejects(repo.checkout(customer, key()), (err) => err.details?.reason === 'DELIVERY_MISSING');
  });

  it(`com a molt ${MAX_PENDING_BOOKINGS} reserves pendents per client`, async () => {
    const [customer] = await createCustomers(pool, 1, 'max');
    for (let i = 0; i < MAX_PENDING_BOOKINGS; i++) {
      await createReadyCart(pool, customer, { productId: FOCO, day: `2031-08-1${i}` });
      await repo.checkout(customer, key());
    }
    await createReadyCart(pool, customer, { productId: FOCO, day: '2031-08-20' });
    await assert.rejects(repo.checkout(customer, key()), (err) => err.status === 409 && err.details.reason === 'TOO_MANY_PENDING');
    assert.equal((await bookings.listBookings(customer)).length, MAX_PENDING_BOOKINGS);
  });

  it('cancel·lar una reserva pendent la torna a la cistella sense marcar-la com a caducada', async () => {
    const [customer] = await createCustomers(pool, 1, 'cancel');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-09-10' });
    await repo.checkout(customer, key());
    assert.equal(await repo.cancelHold(eventId), true);
    assert.equal(await repo.cancelHold(eventId), false);
    assert.equal(await statusOf(eventId), 'draft');
    assert.equal(await activeUnits(eventId), 0);
    assert.equal((await pool.query('SELECT hold_expired_at FROM events WHERE id = $1', [eventId])).rows[0].hold_expired_at, null);
  });

  it('una reserva confirmada ja no caduca', async () => {
    const [customer] = await createCustomers(pool, 1, 'ok');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, day: '2031-10-10' });
    await repo.checkout(customer, key());
    await confirmBooking(pool, eventId);
    await pool.query("UPDATE events SET hold_expires_at = now() - interval '1 second' WHERE id = $1", [eventId]);
    assert.equal(await repo.releaseExpiredHolds(customer), 0);
    assert.equal(await activeUnits(eventId), 1);
  });
});
