import { Router } from 'express';
import { forbiddenError, notFoundError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/cart/checkout (la cistella passa a ser una reserva pendent de pagament) i
 * GET /api/bookings[/:id] (reserves del client). Només per a clients.
 */
export function bookingsRouter({ bookingRepository, cartRepository, deliveryRepository }) {
  const router = Router();

  /** Reserva amb les línies per venedor, el lliurament i els imports congelats. */
  async function view(booking) {
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
  }

  /** Reserva :id del client de la sessió (403 si és d'un altre, 404 si no existeix). */
  async function ownBooking(req) {
    if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
    const booking = await bookingRepository.findBooking(req.params.id.toLowerCase());
    if (!booking) throw notFoundError('Reserva no encontrada');
    if (booking.customerId !== req.user.id) throw forbiddenError('Esta reserva es de otro cliente');
    return booking;
  }

  router.post('/cart/checkout', requireRole('customer'), requireActive, async (req, res) => {
    const draft = await cartRepository.findDraft(req.user.id);
    // Deixa el transport calculat amb el que hi ha ara a la cistella abans de congelar-lo.
    if (draft) await deliveryRepository.getDelivery(draft.id);
    const { id, created } = await bookingRepository.checkout(req.user.id);
    res.status(created ? 201 : 200).json({ data: await view(await bookingRepository.findBooking(id)) });
  });

  router.get('/bookings', requireRole('customer'), async (req, res) => {
    const bookings = await bookingRepository.listBookings(req.user.id);
    res.json({ data: bookings.map(({ customerId, ...booking }) => booking) });
  });

  router.get('/bookings/:id', requireRole('customer'), async (req, res) => {
    res.json({ data: await view(await ownBooking(req)) });
  });

  return router;
}
