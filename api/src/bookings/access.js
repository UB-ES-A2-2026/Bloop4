import { forbiddenError, notFoundError, validationError } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reserva :id del client de la sessió, per a les rutes /api/bookings/:id/… de totes les històries
 * (400 si l'id no és vàlid, 404 si no existeix, 403 si és d'un altre client). Abans de llegir-la
 * s'avisa `beforeBookingRead`: US-12 hi allibera els bloquejos caducats del client.
 */
export function createOwnBooking({ bookingRepository, hooks }) {
  return async function ownBooking(req) {
    if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
    await hooks.emit('beforeBookingRead', req.user.id);
    const booking = await bookingRepository.findBooking(req.params.id.toLowerCase());
    if (!booking) throw notFoundError('Reserva no encontrada');
    if (booking.customerId !== req.user.id) throw forbiddenError('Esta reserva es de otro cliente');
    return booking;
  };
}
