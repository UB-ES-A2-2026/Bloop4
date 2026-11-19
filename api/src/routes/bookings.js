import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';

/**
 * Reserva amb les línies per venedor, el lliurament i els imports congelats (el que retornen
 * GET /api/bookings/:id i el checkout de US-12).
 */
export function createBookingView({ cartRepository, deliveryRepository }) {
  return async function view(booking) {
    const cart = await cartRepository.getCart(booking.id);
    // Una reserva ja no recalcula el transport: es queda amb el preu del moment del checkout.
    const delivery = await deliveryRepository.getDelivery(booking.id, { recalculate: false });
    const transport = delivery?.transportTotal ?? '0.00';
    const { customerId, ...publicFields } = booking;
    return {
      ...publicFields,
      billableDays: cart.billableDays,
      currency: cart.currency,
      sellers: cart.sellers,
      delivery,
      totals: {
        rental: cart.totals.rental,
        deposit: cart.totals.deposit,
        transport,
        toPay: await deliveryRepository.addAmounts(cart.totals.rental, transport),
      },
    };
  };
}

/**
 * GET /api/bookings (reserves del client) i GET /api/bookings/:id (una reserva amb el resum), per a
 * totes les històries que mostren una reserva (fonaments del Sprint 2). Només per a clients. Abans de
 * llegir-les es fa saber `beforeBookingRead` (US-12 hi allibera els bloquejos caducats).
 */
export function bookingsRouter({ bookingRepository, cartRepository, deliveryRepository, ownBooking, hooks }) {
  const router = Router();
  const view = createBookingView({ cartRepository, deliveryRepository });

  router.get('/bookings', requireRole('customer'), async (req, res) => {
    await hooks.emit('beforeBookingRead', req.user.id);
    const bookings = await bookingRepository.listBookings(req.user.id);
    res.json({ data: bookings.map(({ customerId, ...booking }) => booking) });
  });

  router.get('/bookings/:id', requireRole('customer'), async (req, res) => {
    res.json({ data: await view(await ownBooking(req)) });
  });

  return router;
}
