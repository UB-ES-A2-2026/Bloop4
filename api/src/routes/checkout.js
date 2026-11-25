import { Router } from 'express';
import { conflictError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';
import { createBookingView } from './bookings.js';

// Clau que tria el client per a cada intent de checkout (per exemple, un UUID).
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * POST /api/cart/checkout (la cistella passa a ser una reserva pendent de pagament) i
 * POST /api/bookings/:id/cancel (renunciar a una reserva pendent). Només per a clients. Llegir les
 * reserves és dels fonaments (routes/bookings.js).
 */
export function checkoutRouter({ checkoutRepository, bookingRepository, cartRepository, deliveryRepository, ownBooking }) {
  const router = Router();
  const view = createBookingView({ cartRepository, deliveryRepository });

  router.post('/cart/checkout', requireRole('customer'), requireActive, async (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw validationError('Falta la cabecera Idempotency-Key (de 8 a 128 letras, números, guiones o guiones bajos)', {
        field: 'Idempotency-Key',
      });
    }
    const draft = await cartRepository.findDraft(req.user.id);
    // Deixa el transport calculat amb el que hi ha ara a la cistella abans de congelar-lo.
    if (draft) await deliveryRepository.getDelivery(draft.id);
    const { id, created } = await checkoutRepository.checkout(req.user.id, { idempotencyKey });
    res.status(created ? 201 : 200).json({ data: await view(await bookingRepository.findBooking(id)) });
  });

  router.post('/bookings/:id/cancel', requireRole('customer'), requireActive, async (req, res) => {
    const booking = await ownBooking(req);
    if (!(await checkoutRepository.cancelHold(booking.id))) throw conflictError('Esta reserva ya no se puede cancelar');
    res.status(204).end();
  });

  return router;
}
