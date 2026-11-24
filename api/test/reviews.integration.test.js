// Prova les valoracions (US-04) contra PostgreSQL: qui pot valorar, mitjana, paginació i ocultació.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createReviewRepository, shortName } from '../src/repositories/reviewRepository.js';
import { createCatalogRepository } from '../src/repositories/catalogRepository.js';
import { cleanup, createCustomers } from '../test-support/bookingFixtures.js';

const MESA = 'd0000000-0000-4000-8000-000000000011'; // sense valoracions als seeds
const ALTAVOZ = 'd0000000-0000-4000-8000-000000000001'; // 2 valoracions als seeds (5 i 4)
const ADMIN = 'b0000000-0000-4000-8000-000000000005';
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('valoracions (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const reviews = skip ? null : createReviewRepository(pool);
  const catalog = skip ? null : createCatalogRepository(pool);

  /** Reserva d'un client nou amb el producte, en l'estat indicat. */
  async function booking(status, productId = MESA) {
    const [customer] = await createCustomers(pool, 1, 'rev');
    const { rows } = await pool.query(
      `INSERT INTO events (customer_id, status, starts_at, ends_at)
       VALUES ($1, 'draft', now() - interval '3 days', now() - interval '2 days') RETURNING id`,
      [customer],
    );
    await pool.query('INSERT INTO event_items (event_id, product_id, quantity) VALUES ($1, $2, 1)', [rows[0].id, productId]);
    // Passa per pending_payment perquè el trigger hi posi número de reserva.
    if (status !== 'draft') await pool.query("UPDATE events SET status = 'pending_payment', hold_expires_at = now() WHERE id = $1", [rows[0].id]);
    await pool.query('UPDATE events SET status = $2 WHERE id = $1', [rows[0].id, status]);
    return { customer, eventId: rows[0].id };
  }
  const rating = async (productId) => (await catalog.getProduct(productId)).rating;

  before(async () => { if (pool) await cleanupReviews(); });
  after(async () => {
    if (!pool) return;
    await cleanupReviews();
    await pool.query('UPDATE reviews SET hidden = false, hidden_at = NULL, hidden_by = NULL WHERE product_id = $1', [ALTAVOZ]);
    await pool.end();
  });
  async function cleanupReviews() {
    await pool.query("DELETE FROM reviews WHERE customer_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid')");
    await cleanup(pool);
  }

  it('la fitxa porta la mitjana amb un decimal i el nombre de valoracions', async () => {
    assert.deepEqual(await rating(ALTAVOZ), { average: '4.5', count: 2 });
    assert.deepEqual(await rating(MESA), { average: null, count: 0 });
  });

  it('només pot valorar el client d\'una reserva finalitzada amb el producte, una vegada', async () => {
    const done = await booking('completed');
    assert.equal((await reviews.eligibility(MESA, done.customer)).bookings[0].bookingId, done.eventId);
    const review = await reviews.create({ productId: MESA, bookingId: done.eventId, customerId: done.customer, rating: 3, comment: 'Correcta' });
    assert.equal(review.author, 'Cliente D.'); // «Cliente de prueba N»
    assert.equal((await reviews.eligibility(MESA, done.customer)).reason, 'ALREADY_REVIEWED');
    await assert.rejects(
      reviews.create({ productId: MESA, bookingId: done.eventId, customerId: done.customer, rating: 5, comment: null }),
      (err) => err.status === 409,
    );

    const ongoing = await booking('confirmed');
    const notFinished = await reviews.eligibility(MESA, ongoing.customer);
    assert.deepEqual([notFinished.bookings, notFinished.reason, notFinished.reviewAgainLater], [[], 'NOT_FINISHED', false]);
    const [stranger] = await createCustomers(pool, 1, 'rev-none');
    const notRented = await reviews.eligibility(MESA, stranger);
    assert.deepEqual([notRented.bookings, notRented.reason, notRented.history], [[], 'NOT_RENTED', []]);
    // Encara que se salti l'API, la BD no deixa valorar sense una reserva finalitzada.
    await assert.rejects(
      reviews.create({ productId: MESA, bookingId: ongoing.eventId, customerId: ongoing.customer, rating: 5, comment: null }),
      (err) => err.code === '23514',
    );
  });

  it('una valoració per reserva: amb una altra reserva finalitzada es pot tornar a valorar', async () => {
    const [customer] = await createCustomers(pool, 1, 'rev-twice');
    const event = async (status, daysAgo) => {
      const { rows } = await pool.query(
        `INSERT INTO events (customer_id, status, starts_at, ends_at)
         VALUES ($1, 'draft', now() - make_interval(days => $2 + 1), now() - make_interval(days => $2)) RETURNING id`,
        [customer, daysAgo],
      );
      await pool.query('INSERT INTO event_items (event_id, product_id, quantity) VALUES ($1, $2, 1)', [rows[0].id, MESA]);
      await pool.query("UPDATE events SET status = 'pending_payment', hold_expires_at = now() WHERE id = $1", [rows[0].id]);
      await pool.query('UPDATE events SET status = $2 WHERE id = $1', [rows[0].id, status]);
      return rows[0].id;
    };
    const first = await event('completed', 20);
    const second = await event('completed', 5);
    await reviews.create({ productId: MESA, bookingId: first, customerId: customer, rating: 4, comment: null });
    assert.deepEqual((await reviews.eligibility(MESA, customer)).bookings.map((b) => b.bookingId), [second]);
    await reviews.create({ productId: MESA, bookingId: second, customerId: customer, rating: 5, comment: null });

    // Valorat amb totes les reserves acabades i una altra en curs: «ja l'ha valorat», i podrà
    // tornar-hi quan acabi la que està en curs.
    await event('confirmed', -10);
    const now = await reviews.eligibility(MESA, customer);
    assert.deepEqual([now.bookings, now.reason, now.reviewAgainLater], [[], 'ALREADY_REVIEWED', true]);
    assert.deepEqual(now.history.map((b) => [b.finished, b.reviewed]).sort(), [[false, false], [true, true], [true, true]]);
  });

  it('les valoracions es llisten de la més recent a la més antiga, paginades', async () => {
    const first = await booking('completed');
    const second = await booking('completed');
    await reviews.create({ productId: MESA, bookingId: first.eventId, customerId: first.customer, rating: 5, comment: 'Primera' });
    await pool.query("UPDATE reviews SET created_at = now() - interval '1 day' WHERE event_id = $1", [first.eventId]);
    await reviews.create({ productId: MESA, bookingId: second.eventId, customerId: second.customer, rating: 1, comment: 'Segona' });

    const page1 = await reviews.list(MESA, { limit: 1, offset: 0 });
    assert.equal(page1.reviews[0].comment, 'Segona');
    assert.equal(page1.total, 5); // amb les dels tests anteriors
    // «Primera» és la més antiga (fa un dia): surt a l'última pàgina.
    const last = await reviews.list(MESA, { limit: 1, offset: 4 });
    assert.equal(last.reviews[0].comment, 'Primera');
    assert.deepEqual(await reviews.list(MESA, { limit: 1, offset: 10 }), { reviews: [], total: 5 });
    assert.deepEqual(await rating(MESA), { average: '3.6', count: 5 }); // 3, 4, 5, 5 i 1
  });

  it('una valoració oculta no es mostra ni compta a la mitjana', async () => {
    const { reviews: list } = await reviews.list(ALTAVOZ, { limit: 10, offset: 0 });
    const four = list.find((r) => r.rating === 4);
    assert.equal(await reviews.hide(four.id, ADMIN), true);
    assert.equal(await reviews.hide(four.id, ADMIN), true);
    assert.deepEqual(await rating(ALTAVOZ), { average: '5.0', count: 1 });
    assert.equal((await reviews.list(ALTAVOZ, { limit: 10, offset: 0 })).reviews.some((r) => r.id === four.id), false);
    assert.equal(await reviews.hide('f0000000-0000-4000-8000-0000000000ff', ADMIN), false);
  });

  it('el nom que es mostra és el nom i la inicial del cognom', () => {
    assert.equal(shortName('Laura Cliente'), 'Laura C.');
    assert.equal(shortName('Ana'), 'Ana');
    assert.equal(shortName('  marta   rider  '), 'marta R.');
  });
});
