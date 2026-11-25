/** Client de /api/notifications (avisos dins de l'aplicació). */
import { request } from './http';

/** @returns {{ notifications: object[], unreadCount: number }} */
export async function fetchNotifications({ signal } = {}) {
  const json = await request('/notifications', { signal });
  return { notifications: json.data, unreadCount: json.unreadCount ?? 0 };
}

export function markNotificationRead(id) {
  return request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', shape: 'none' });
}

export function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'POST', shape: 'none' });
}
