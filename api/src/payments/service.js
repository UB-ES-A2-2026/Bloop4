import { randomUUID } from 'node:crypto';
import { conflictError } from '../errors.js';
import { maskEmail } from '../mail/mailer.js';
import { PaymentDeclinedError } from './gateway.js';

// La fiança es reté, com a molt, aquests dies abans del lliurament: la passarel·la no manté una
// autorització més temps. Si en falta més, la retenció queda programada.
export const DEPOSIT_HOLD_DAYS = 7;

/**
 * Pagament d'una reserva (US-08). El client paga a la pàgina de la passarel·la i la reserva només
 * es confirma quan el servidor rep l'avís signat (webhook): la tornada del navegador no confirma res.
 */
export function createPaymentService({ gateway, paymentRepository, bookingService, mailer, config, logger = console, now = () => new Date() }) {
  async function notify(send, to) {
    try {
      await send();
    } catch (err) {
      logger.error({ err }, `No se pudo enviar el correo de pago a ${maskEmail(to)}`);
    }
  }

  /** Intenta retenir la fiança ara. Si la targeta la rebutja, queda com a fallida i s'avisa el client. */
  async function attemptHold(hold) {
    const payment = await paymentRepository.findSucceeded(hold.eventId);
    const customer = await paymentRepository.findCustomer(hold.eventId);
    try {
      const { ref } = await gateway.holdDeposit({
        eventId: hold.eventId,
        bookingNumber: customer.bookingNumber,
        amountMinor: hold.amountMinor,
        currency: hold.currency,
        customerRef: payment?.customerRef,
        chargeRef: payment?.chargeRef,
      });
      await paymentRepository.markHeld(hold.eventId, ref);
      return true;
    } catch (err) {
      if (!(err instanceof PaymentDeclinedError)) throw err;
      await paymentRepository.markHoldFailed(hold.eventId, err.message);
      await notify(
        () => mailer.sendDepositFailedEmail({ to: customer.email, name: customer.fullName, bookingNumber: customer.bookingNumber, amount: hold.amount, currency: hold.currency }),
        customer.email,
      );
      return false;
    }
  }

  /**
   * Després de cobrar: si hi ha fiança, es reté ara (si el lliurament és d'aquí a 7 dies o menys)
   * o es deixa programada per a 7 dies abans del lliurament.
   */
  async function setUpDeposit(eventId) {
    const due = await paymentRepository.depositDue(eventId);
    if (Number(due.amount) === 0) return;
    const holdFrom = new Date(new Date(due.deliveryStartsAt ?? now()).getTime() - DEPOSIT_HOLD_DAYS * 24 * 60 * 60 * 1000);
    await paymentRepository.scheduleHold({ eventId, amount: due.amount, currency: due.currency, provider: gateway.name, scheduledFor: holdFrom });
    if (holdFrom <= now()) await attemptHold(await paymentRepository.findHold(eventId));
  }

  return {
    provider: gateway.name,

    /**
     * Inicia el pagament d'una reserva pendent i retorna la pàgina on pagar. Si ja hi ha un
     * pagament en curs es reaprofita: una reserva no té mai dues sessions de pagament obertes.
     */
    async start(booking, user) {
      if (booking.status !== 'pending_payment') throw conflictError('Esta reserva no está pendiente de pago', { reason: 'NOT_PENDING' });
      if (new Date(booking.holdExpiresAt) <= now()) {
        throw conflictError('El tiempo para pagar ha terminado. Vuelve a tu reserva y comprueba la disponibilidad', { reason: 'HOLD_EXPIRED' });
      }
      const pending = await paymentRepository.findPending(booking.id);
      if (pending) return pending;

      const due = await paymentRepository.amountDue(booking.id);
      const paymentId = randomUUID();
      const checkout = await gateway.createCheckout({
        paymentId,
        bookingNumber: booking.bookingNumber,
        amountMinor: due.amountMinor,
        currency: due.currency,
        customerEmail: user.email,
        successUrl: `${config.appUrl}/reservas/${booking.id}?pago=ok`,
        cancelUrl: `${config.appUrl}/reservas/${booking.id}?pago=cancelado`,
      });
      const created = await paymentRepository.create({
        id: paymentId,
        eventId: booking.id,
        provider: gateway.name,
        ref: checkout.ref,
        checkoutUrl: checkout.url,
        amount: due.amount,
        currency: due.currency,
      });
      if (created) return created;
      // Una altra petició simultània ha creat el pagament: la sessió d'aquesta es descarta.
      await gateway.expireCheckout(checkout.ref);
      return paymentRepository.findPending(booking.id);
    },

    /** Estat del pagament d'una reserva per al client (en tornar de la passarel·la o més tard). */
    async status(eventId) {
      const payment = await paymentRepository.findLatest(eventId);
      const hold = await paymentRepository.findHold(eventId);
      // La fiança es mostra a part: es reté, no es cobra.
      const deposit = hold && {
        status: hold.status,
        amount: hold.amount,
        currency: hold.currency,
        scheduledFor: hold.status === 'scheduled' ? hold.scheduledFor : null,
        heldAt: hold.heldAt,
        releasedAt: hold.releasedAt,
      };
      if (!payment) return { status: 'none', deposit: null };
      return {
        deposit: deposit ?? null,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        receiptNumber: payment.receiptNumber,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason,
        // Només mentre està en curs: on continuar el pagament.
        checkoutUrl: payment.status === 'pending' ? payment.checkoutUrl : null,
      };
    },

    /**
     * Processa un avís de la passarel·la. `gateway.parseWebhook` en comprova la signatura (llança
     * WebhookSignatureError). Un avís repetit o d'un pagament desconegut s'ignora.
     * @returns {Promise<'processed' | 'ignored'>}
     */
    async handleWebhook(rawBody, headers) {
      const event = gateway.parseWebhook(rawBody, headers);
      if (!event) return 'ignored';
      const payment = await paymentRepository.findByRef(gateway.name, event.ref);
      if (!payment) return 'ignored';
      if (!(await paymentRepository.recordWebhookEvent(gateway.name, event.id))) return 'ignored';

      if (event.type === 'checkout.failed') {
        await paymentRepository.markClosed(payment.id, 'failed', event.reason ?? 'El pago ha sido rechazado');
        return 'processed';
      }
      if (event.type === 'checkout.expired') {
        await paymentRepository.markClosed(payment.id, 'cancelled');
        return 'processed';
      }

      // checkout.succeeded
      if (!(await paymentRepository.markSucceeded(payment.id, { chargeRef: event.chargeRef, customerRef: event.customerRef }))) {
        return 'ignored';
      }
      const customer = await paymentRepository.findCustomer(payment.eventId);
      const booking = await bookingService.confirm(payment.eventId);
      if (!booking) {
        // El bloqueig havia caducat abans que arribés el pagament: el material ja no està
        // garantit, així que es retorna l'import en lloc de confirmar la reserva.
        await gateway.refund(event.chargeRef);
        await paymentRepository.markRefunded(payment.id, 'La reserva había caducado antes de recibir el pago');
        if (customer) await notify(() => mailer.sendPaymentRefundedEmail({ to: customer.email, name: customer.fullName, bookingNumber: customer.bookingNumber }), customer.email);
        return 'processed';
      }
      try {
        await setUpDeposit(payment.eventId);
      } catch (err) {
        // El pagament ja és ferm: un error amb la fiança no ha de fer repetir el webhook.
        logger.error({ err }, 'No se pudo preparar la retención de la fianza');
      }
      const paid = await paymentRepository.findLatest(payment.eventId);
      if (customer) {
        await notify(
          () => mailer.sendReceiptEmail({
            to: customer.email,
            name: customer.fullName,
            bookingNumber: booking.bookingNumber,
            receiptNumber: paid.receiptNumber,
            amount: paid.amount,
            currency: paid.currency,
            paidAt: paid.paidAt,
          }),
          customer.email,
        );
      }
      return 'processed';
    },

    /**
     * Tasca periòdica: tanca a la passarel·la les sessions de pagament de reserves que ja no
     * estan pendents (bloqueig caducat o reserva cancel·lada), perquè ja no es puguin pagar.
     */
    async closeStalePayments() {
      const stale = await paymentRepository.findStale();
      for (const payment of stale) {
        await gateway.expireCheckout(payment.ref);
        await paymentRepository.markClosed(payment.id, 'cancelled');
      }
      return stale.length;
    },

    /** Tasca periòdica: fa les retencions de fiança programades que ja toquen. Retorna quantes. */
    async processDueDeposits() {
      const due = await paymentRepository.findDueHolds();
      for (const hold of due) await attemptHold(hold);
      return due.length;
    },

    /**
     * Allibera la fiança d'una reserva (el material ha tornat bé i no hi ha incidències pendents).
     * @returns {Promise<boolean>} false si no hi havia res retingut ni programat
     */
    async releaseDeposit(eventId) {
      const hold = await paymentRepository.findHold(eventId);
      if (!hold || !['held', 'scheduled'].includes(hold.status)) return false;
      if (hold.status === 'held') await gateway.releaseDeposit(hold.ref);
      return paymentRepository.markReleased(eventId);
    },
  };
}
