import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationsApi';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../lib/dates';

export const NOTIFICATIONS_POLL_MS = 30_000;

/** Campana del menú amb els avisos de l'usuari (es consulten cada 30 s). */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const load = useCallback((signal) => fetchNotifications({ signal }), []);
  const { data, refresh } = usePolling(load, NOTIFICATIONS_POLL_MS);
  const unread = data?.unreadCount ?? 0;

  async function read(notification) {
    setOpen(false);
    if (!notification.readAt) await markNotificationRead(notification.id).catch(() => {});
    refresh();
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => {});
    refresh();
  }

  return (
    <div className="notifications">
      <button
        type="button"
        className="nav__link nav__button notifications__toggle"
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Avisos
        {unread > 0 && (
          <span className="notifications__count" aria-label={`${unread} sin leer`}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div id="notifications-panel" className="notifications__panel" role="region" aria-label="Avisos">
          {!data?.notifications.length ? (
            <p className="form__hint">No tienes avisos.</p>
          ) : (
            <>
              <ul className="notifications__list">
                {data.notifications.map((n) => (
                  <li key={n.id} className={n.readAt ? '' : 'notifications__item--unread'}>
                    <Link to={n.link ?? '/'} onClick={() => read(n)}>
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <span className="form__hint">{formatDateTime(n.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {unread > 0 && (
                <button type="button" className="link-button" onClick={readAll}>
                  Marcar todo como leído
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
