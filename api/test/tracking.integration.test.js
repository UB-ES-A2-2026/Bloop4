// Prova el seguiment (US-09) contra PostgreSQL: transicions del rider, historial, retards, venedors
// independents i avisos al client.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createTrackingRepository } from '../src/repositories/trackingRepository.js';
import { createNotificationRepository } from '../src/repositories/notificationRepository.js';
import { createServiceNotifier } from '../src/tracking/notifier.js';
import { assignService, cleanup, confirmBooking, createCustomers, createReadyCart, createRiders } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006'; // Sonido Levante
const SILLA = 'd0000000-0000-4000-8000-000000000009'; // Mobiliario Turia
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('seguiment de la reserva (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const tracking = skip ? null : createTrackingRepository(pool);
  const notifications = skip ? null : createNotificationRepository(pool);
  const notifier = skip ? null : createServiceNotifier({ trackingRepository: tracking, notificationRepository: notifications, logger: { error() {} } });

  /** Reserva confirmada amb els serveis acceptats per un rider nou per venedor (a la mateixa hora no en pot fer dos). */
  async function booking(day, products = [FOCO]) {
    const [customer] = await createCustomers(pool, 1, 'track');
    const eventId = await createReadyCart(pool, customer, { productId: products[0], day });
    for (const extra of products.slice(1)) {
      await pool.query('INSERT INTO event_items (event_id, product_id, quantity) VALUES ($1, $2, 1)', [eventId, extra]);
      await pool.query(
        `INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type)
         SELECT $1, p.seller_id, d.delivery_type, d.time_window, 'van' FROM deliveries d, products p
         WHERE d.event_id = $1 AND p.id = $2`,
        [eventId, extra],
      );
    }
    await confirmBooking(pool, eventId);
    const { rows } = await pool.query(
      'SELECT d.id, d.delivery_type, d.seller_id FROM deliveries d WHERE d.event_id = $1 ORDER BY d.seller_id, d.delivery_type DESC',
      [eventId],
    );
    const riderBySeller = {};
    for (const row of rows) {
      riderBySeller[row.seller_id] ??= (await createRiders(pool, 1, 'truck'))[0];
      await assignService(pool, row.id, riderBySeller[row.seller_id]);
    }
    return { eventId, customer, riderId: riderBySeller[rows[0].seller_id], riderBySeller, services: rows };
  }
  const first = (b, type) => b.services.find((s) => s.delivery_type === type).id;

  before(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid')");
    await cleanup(pool);
  });
  after(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid')");
    await cleanup(pool);
    await pool.end();
  });

  it('el rider inicia el lliurament: canvia la fase, queda a l\'historial i el client rep un avís', async () => {
    const b = await booking('2033-03-10');
    const delivery = first(b, 'delivery');
    let [group] = await tracking.tracking(b.eventId);
    assert.equal(group.phase, 'confirmed');

    await tracking.start(delivery, b.riderId);
    await notifier.statusChanged(delivery);
    [group] = await tracking.tracking(b.eventId);
    assert.equal(group.phase, 'delivery_in_transit');
    assert.deepEqual(group.delivery.history.map((h) => h.status), ['pending', 'assigned', 'in_transit']);
    assert.match(group.delivery.history[2].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const { notifications: list, unreadCount } = await notifications.list(b.customer);
    assert.equal(unreadCount, 1);
    assert.deepEqual([list[0].title, list[0].link], ['Tu entrega está en camino', `/reservas/${b.eventId}`]);
  });

  it('no es pot iniciar dues vegades, ni la recollida abans del lliurament, ni un servei d\'un altre', async () => {
    const b = await booking('2033-03-11');
    const delivery = first(b, 'delivery');
    await assert.rejects(tracking.start(first(b, 'pickup'), b.riderId), (err) => err.details?.reason === 'DELIVERY_NOT_DONE');
    await tracking.start(delivery, b.riderId);
    await assert.rejects(tracking.start(delivery, b.riderId), (err) => err.status === 409 && err.details.status === 'in_transit');
    const [other] = await createRiders(pool, 1, 'van');
    await assert.rejects(tracking.start(delivery, other), (err) => err.status === 404);
    await assert.rejects(tracking.transition(delivery, b.riderId, { from: 'in_transit', to: 'assigned' }), (err) => err.details?.reason === 'INVALID_TRANSITION');
  });

  it('la recollida pot començar quan el lliurament s\'ha completat, i la fase avança fins a recollida', async () => {
    const b = await booking('2033-03-12');
    await tracking.start(first(b, 'delivery'), b.riderId);
    await tracking.transition(first(b, 'delivery'), b.riderId, { from: 'in_transit', to: 'delivered' });
    assert.equal((await tracking.tracking(b.eventId))[0].phase, 'delivered');
    await tracking.start(first(b, 'pickup'), b.riderId);
    assert.equal((await tracking.tracking(b.eventId))[0].phase, 'pickup_in_transit');
    await tracking.transition(first(b, 'pickup'), b.riderId, { from: 'in_transit', to: 'delivered' });
    assert.equal((await tracking.tracking(b.eventId))[0].phase, 'picked_up');
  });

  it('amb diversos venedors, cada un té el seu seguiment independent', async () => {
    const b = await booking('2033-03-13', [FOCO, SILLA]);
    const SONIDO = 'a0000000-0000-4000-8000-000000000001';
    const sonido = b.services.find((s) => s.delivery_type === 'delivery' && s.seller_id === SONIDO).id;
    await tracking.start(sonido, b.riderBySeller[SONIDO]);
    const groups = await tracking.tracking(b.eventId);
    assert.deepEqual(groups.map((g) => [g.seller.legalName, g.phase]), [
      ['Mobiliario Eventos Turia S.L.', 'confirmed'],
      ['Sonido Levante S.L.', 'delivery_in_transit'],
    ]);
  });

  it('un servei que no s\'ha completat quan acaba la franja surt amb retard', async () => {
    const b = await booking('2033-03-14');
    const delivery = first(b, 'delivery');
    await pool.query("UPDATE deliveries SET time_window = tstzrange(now() - interval '3 hours', now() - interval '1 hour', '[)') WHERE id = $1", [delivery]);
    assert.equal((await tracking.tracking(b.eventId))[0].delivery.delayed, true);
    await pool.query("UPDATE deliveries SET status = 'in_transit' WHERE id = $1", [delivery]);
    await pool.query("UPDATE deliveries SET status = 'delivered' WHERE id = $1", [delivery]);
    assert.equal((await tracking.tracking(b.eventId))[0].delivery.delayed, false);
  });
});
