// Prova els avisos dins de l'aplicació (fonaments del Sprint 2: els creen el seguiment i les
// incidències) contra PostgreSQL.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createNotificationRepository } from '../src/repositories/notificationRepository.js';
import { cleanup, createCustomers } from '../test-support/bookingFixtures.js';

const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('notificationRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const notifications = skip ? null : createNotificationRepository(pool);
  const removeTestNotifications = () =>
    pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid')");

  before(async () => {
    if (!pool) return;
    await removeTestNotifications();
    await cleanup(pool);
  });
  after(async () => {
    if (!pool) return;
    await removeTestNotifications();
    await cleanup(pool);
    await pool.end();
  });

  it('llista els avisos de l\'usuari del més recent al més antic, amb els que no ha llegit', async () => {
    const [user] = await createCustomers(pool, 1, 'notif');
    await notifications.create(user, { kind: 'service_status', title: 'Primer' });
    await pool.query("UPDATE notifications SET created_at = now() - interval '1 minute' WHERE user_id = $1", [user]);
    await notifications.create(user, { kind: 'incident', title: 'Segon', body: 'Detall', link: '/reservas/x' });
    const { notifications: list, unreadCount } = await notifications.list(user);
    assert.deepEqual(list.map((n) => [n.title, n.kind, n.body, n.link, n.readAt]), [
      ['Segon', 'incident', 'Detall', '/reservas/x', null],
      ['Primer', 'service_status', null, null, null],
    ]);
    assert.equal(unreadCount, 2);
    assert.equal((await notifications.list(user, 1)).notifications.length, 1);
  });

  it('cada usuari només marca els seus avisos', async () => {
    const [a, other] = await createCustomers(pool, 2, 'notif');
    await notifications.create(a, { kind: 'service_status', title: 'Hola', link: '/reservas' });
    const { notifications: [n] } = await notifications.list(a);
    assert.equal(await notifications.markRead(n.id, other), false);
    assert.equal(await notifications.markRead(n.id, a), true);
    assert.equal((await notifications.list(a)).unreadCount, 0);
  });

  it('marcar-los tots com a llegits només toca els de l\'usuari', async () => {
    const [a, other] = await createCustomers(pool, 2, 'notif');
    await notifications.create(a, { kind: 'service_status', title: 'A' });
    await notifications.create(other, { kind: 'service_status', title: 'B' });
    await notifications.markAllRead(a);
    assert.equal((await notifications.list(a)).unreadCount, 0);
    assert.equal((await notifications.list(other)).unreadCount, 1);
  });
});
