import { maskEmail } from '../mail/mailer.js';

/**
 * Avís als venedors d'una reserva confirmada (US-12, criteri 4): un correu a cada venedor amb
 * material a la reserva. És el gestor del fet `bookingConfirmed`; un correu que falla no desfà la
 * confirmació.
 */
export function notifySellers({ mailer, logger = console }) {
  return async function onBookingConfirmed({ booking, sellers }) {
    for (const seller of sellers) {
      if (!seller.email) continue;
      try {
        await mailer.sendNewBookingEmail({
          to: seller.email,
          sellerName: seller.legalName,
          bookingNumber: booking.bookingNumber,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        });
      } catch (err) {
        logger.error({ err }, `No se pudo avisar de la reserva a ${maskEmail(seller.email)}`);
      }
    }
  };
}
