import { Router } from 'express';
import { requireActive, requireRole } from '../auth/middleware.js';
import { createBookingView } from './bookings.js';

/**
 * POST /api/cart/checkout (la cistella passa a ser una reserva pendent de pagament). Només per a
 * clients. Llegir les reserves és dels fonaments (routes/bookings.js).
 */
export function checkoutRouter({ checkoutRepository, bookingRepository, cartRepository, deliveryRepository }) {
  const router = Router();
  const view = createBookingView({ cartRepository, deliveryRepository });

  router.post('/cart/checkout', requireRole('customer'), requireActive, async (req, res) => {
    const draft = await cartRepository.findDraft(req.user.id);
    // Deixa el transport calculat amb el que hi ha ara a la cistella abans de congelar-lo.
    if (draft) await deliveryRepository.getDelivery(draft.id);
    const { id, created } = await checkoutRepository.checkout(req.user.id);
    res.status(created ? 201 : 200).json({ data: await view(await bookingRepository.findBooking(id)) });
  });

  return router;
}
