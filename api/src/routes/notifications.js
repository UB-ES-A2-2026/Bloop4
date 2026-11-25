import { Router } from 'express';
import { notFoundError, validationError } from '../errors.js';
import { requireAuth } from '../auth/middleware.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /api/notifications: avisos de l'usuari de la sessió. El frontend els torna a demanar cada 30 s. */
export function notificationsRouter({ notificationRepository }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { notifications, unreadCount } = await notificationRepository.list(req.user.id);
    res.set('Cache-Control', 'no-store');
    res.json({ data: notifications, unreadCount });
  });

  router.post('/read-all', async (req, res) => {
    await notificationRepository.markAllRead(req.user.id);
    res.status(204).end();
  });

  router.post('/:id/read', async (req, res) => {
    if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
    if (!(await notificationRepository.markRead(req.params.id.toLowerCase(), req.user.id))) throw notFoundError('Aviso no encontrado');
    res.status(204).end();
  });

  return router;
}
