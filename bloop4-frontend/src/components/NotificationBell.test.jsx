import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationsApi';

vi.mock('../api/notificationsApi', () => ({ fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));

const notification = (overrides = {}) => ({
  id: 'n1', kind: 'service_status', title: 'Tu entrega está en camino', body: 'Sonido Levante S.L. va hacia la dirección del evento.',
  link: '/reservas/b1', createdAt: '2030-06-15T06:30:00.000Z', readAt: null, ...overrides,
});

beforeEach(() => {
  fetchNotifications.mockReset();
  markNotificationRead.mockReset().mockResolvedValue(null);
  markAllNotificationsRead.mockReset().mockResolvedValue(null);
});

describe('NotificationBell', () => {
  it('mostra quants avisos hi ha sense llegir i la llista amb l\'enllaç', async () => {
    fetchNotifications.mockResolvedValue({ notifications: [notification(), notification({ id: 'n2', title: 'Material entregado', readAt: '2030-06-15T07:00:00Z' })], unreadCount: 1 });
    render(<NotificationBell />, { wrapper: MemoryRouter });

    expect(await screen.findByLabelText('1 sin leer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Avisos/ }));
    const link = screen.getByRole('link', { name: /Tu entrega está en camino/ });
    expect(link.getAttribute('href')).toBe('/reservas/b1');

    fireEvent.click(link);
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n1'));
  });

  it('«Marcar todo como leído» els marca tots; sense avisos ho diu', async () => {
    fetchNotifications.mockResolvedValueOnce({ notifications: [notification()], unreadCount: 1 }).mockResolvedValue({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />, { wrapper: MemoryRouter });
    await screen.findByLabelText('1 sin leer');
    fireEvent.click(screen.getByRole('button', { name: /Avisos/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todo como leído' }));
    expect(await screen.findByText('No tienes avisos.')).toBeTruthy();
    expect(markAllNotificationsRead).toHaveBeenCalled();
    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
  });
});
