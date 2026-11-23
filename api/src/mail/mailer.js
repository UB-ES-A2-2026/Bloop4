import nodemailer from 'nodemailer';

/**
 * Enviament de correus de l'app. En desenvolupament, SMTP_HOST apunta a Mailpit
 * (http://localhost:8025), que no demana contrasenya. A la VM apunta a Gmail, amb SMTP_USER i
 * SMTP_PASS. Sense SMTP_HOST, els correus no s'envien i només es registra un avís.
 * Mai s'escriu als logs l'enllaç de verificació: dona accés al compte.
 *
 * Sprint 2: cada història afegeix els seus correus dins de la seva zona (`// ── US-xx ──`), als dos
 * objectes: el de sense SMTP i el de veritat.
 */
export function createMailer({
  host = process.env.SMTP_HOST,
  port = Number(process.env.SMTP_PORT ?? 1025),
  user = process.env.SMTP_USER,
  pass = process.env.SMTP_PASS,
  from = process.env.MAIL_FROM ?? 'Bloop4 <no-reply@bloop4.local>',
  logger = console,
} = {}) {
  if (!host) {
    return {
      async sendVerificationEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el correo de verificación a ${maskEmail(to)}`);
      },
      // ── US-12 ──
      // ── US-08 ──
      async sendReceiptEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el comprobante de pago a ${maskEmail(to)}`);
      },
      async sendDepositFailedEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el aviso de la fianza a ${maskEmail(to)}`);
      },
      async sendPaymentRefundedEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el aviso de devolución a ${maskEmail(to)}`);
      },
      // ── fi de les zones ──
    };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass } } : {}),
  });
  return {
    async sendVerificationEmail({ to, name, link }) {
      await transport.sendMail({
        from,
        to,
        subject: 'Confirma tu correo en Bloop4',
        text: `Hola ${name}:\n\nPara activar tu cuenta, abre este enlace (caduca en 24 horas):\n${link}\n\nSi no te has registrado en Bloop4, ignora este correo.`,
      });
    },

    // ── US-12 ──
    // ── US-08 ──
    /** Comprovant del pagament d'una reserva (US-08). */
    async sendReceiptEmail({ to, name, bookingNumber, receiptNumber, amount, currency, paidAt }) {
      const total = new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(Number(amount));
      await transport.sendMail({
        from,
        to,
        subject: `Comprobante de pago ${receiptNumber} · Reserva ${bookingNumber}`,
        text: `Hola, ${name}:\n\nHemos recibido tu pago de ${total} el ${formatEmailDate(paidAt)}.\nComprobante: ${receiptNumber}\nReserva: ${bookingNumber}\n\nTu reserva está confirmada. Puedes ver el detalle en «Mis reservas».`,
      });
    },

    /** La retenció de la fiança ha fallat: el client l'ha de resoldre abans del lliurament. */
    async sendDepositFailedEmail({ to, name, bookingNumber, amount, currency }) {
      const total = new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(Number(amount));
      await transport.sendMail({
        from,
        to,
        subject: `No hemos podido retener la fianza · Reserva ${bookingNumber}`,
        text: `Hola, ${name}:\n\nTu tarjeta ha rechazado la retención de la fianza de ${total} de la reserva ${bookingNumber}. La fianza no se cobra: solo se retiene hasta que devuelvas el material.\n\nPonte en contacto con nosotros para resolverlo antes de la entrega.`,
      });
    },

    /** El pagament ha arribat quan la reserva ja havia caducat: s'ha retornat l'import. */
    async sendPaymentRefundedEmail({ to, name, bookingNumber }) {
      await transport.sendMail({
        from,
        to,
        subject: `Hemos devuelto tu pago · Reserva ${bookingNumber}`,
        text: `Hola, ${name}:\n\nTu pago llegó cuando el tiempo para pagar la reserva ${bookingNumber} ya había terminado y el material se había liberado. Te hemos devuelto el importe íntegro.\n\nPuedes volver a tu reserva y confirmarla de nuevo.`,
      });
    },
    // ── fi de les zones ──
  };
}

const EMAIL_DATE_TIME = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

/** Data i hora d'un correu («15 jun 2030, 18:00»), en hora de Madrid. */
export function formatEmailDate(date) {
  return EMAIL_DATE_TIME.format(new Date(date));
}

/** laura@example.com → l***@example.com (per als logs). */
export function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 1)}***@${domain ?? ''}`;
}
