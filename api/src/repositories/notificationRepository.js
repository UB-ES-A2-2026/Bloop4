/** Avisos dins de l'aplicació (US-09). Cada usuari només llegeix i marca els seus. */

function toNotification(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export function createNotificationRepository(pool) {
  return {
    async create(userId, { kind, title, body = null, link = null }) {
      await pool.query('INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, $2, $3, $4, $5)', [
        userId,
        kind,
        title,
        body,
        link,
      ]);
    },

    /** Avisos més recents de l'usuari i quants n'hi ha sense llegir. */
    async list(userId, limit = 20) {
      const { rows } = await pool.query(
        'SELECT id, kind, title, body, link, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id LIMIT $2',
        [userId, limit],
      );
      const unread = await pool.query('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]);
      return { notifications: rows.map(toNotification), unreadCount: unread.rows[0].n };
    },

    /** Marca un avís com a llegit. false si no existeix o és d'un altre usuari. */
    async markRead(id, userId) {
      const { rowCount } = await pool.query(
        'UPDATE notifications SET read_at = coalesce(read_at, now()) WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      return rowCount === 1;
    },

    async markAllRead(userId) {
      await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
    },
  };
}
