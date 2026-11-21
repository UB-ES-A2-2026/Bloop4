/**
 * Confirmació d'una reserva quan el pagament s'ha completat (US-08, des del webhook): passa a
 * 'confirmed' i es fa saber (`bookingConfirmed`) perquè hi reaccionin les altres històries (US-12
 * hi avisa els venedors).
 */
export function createBookingService({ bookingRepository, hooks }) {
  return {
    /** @returns la reserva confirmada, o null si ja no estava pendent de pagament */
    async confirm(eventId) {
      const result = await bookingRepository.confirm(eventId);
      if (!result) return null;
      await hooks.emit('bookingConfirmed', result);
      return result.booking;
    },
  };
}
