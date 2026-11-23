import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import { parseServiceId } from './riderAccess.js';

/**
 * POST /api/rider/services/:id/start (US-09): el rider surt cap al lloc del servei, que passa a
 * 'in_transit'. Sota /api/rider: abans hi ha `requireRider` dels fonaments. Es fa saber
 * (`serviceStatusChanged`) perquè s'avisi el client.
 */
export function riderTrackingRouter({ trackingRepository, riderRepository, hooks }) {
  const router = Router();
  router.post('/services/:id/start', async (req, res) => {
    const id = parseServiceId(req.params.id);
    await trackingRepository.start(id, req.rider.userId);
    res.json({ data: await riderRepository.findMine(id, req.rider.userId) });
  });
  return router;
}

/** GET /api/bookings/:id/tracking: seguiment dels lliuraments i recollides d'una reserva del client. */
export function bookingTrackingRouter({ trackingRepository, ownBooking }) {
  const router = Router();
  // El frontend el torna a demanar periòdicament.
  router.get('/bookings/:id/tracking', requireRole('customer'), async (req, res) => {
    const booking = await ownBooking(req);
    res.set('Cache-Control', 'no-store');
    res.json({
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        checkedAt: new Date().toISOString(),
        sellers: await trackingRepository.tracking(booking.id),
      },
    });
  });
  return router;
}
