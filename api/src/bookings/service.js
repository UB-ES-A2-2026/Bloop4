import { maskEmail } from '../mail/mailer.js';

/**
 * Confirmació d'una reserva quan el pagament s'ha completat (US-08 la crida des del webhook):
 * passa a 'confirmed' i s'avisa cada venedor. Un correu que falla no desfà la confirmació.
 */
export function createBookingService({ bookingRepository, mailer, logger = console }) {
  return {
    /** @returns la reserva confirmada, o null si ja no estava pendent de pagament */
    async confirm(eventId) {
      const result = await bookingRepository.confirm(eventId);
      if (!result) return null;
      for (const seller of result.sellers) {
        if (!seller.email) continue;
        try {
          await mailer.sendNewBookingEmail({
            to: seller.email,
            sellerName: seller.legalName,
            bookingNumber: result.booking.bookingNumber,
            startsAt: result.booking.startsAt,
            endsAt: result.booking.endsAt,
          });
        } catch (err) {
          logger.error({ err }, `No se pudo avisar de la reserva a ${maskEmail(seller.email)}`);
        }
      }
      return result.booking;
    },
  };
}
