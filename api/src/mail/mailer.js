import nodemailer from 'nodemailer';

/**
 * Enviament de correus de l'app. En desenvolupament, SMTP_HOST apunta a Mailpit
 * (http://localhost:8025), que no demana contrasenya. A la VM apunta a Gmail, amb SMTP_USER i
 * SMTP_PASS. Sense SMTP_HOST, els correus no s'envien i només es registra un avís.
 * Mai s'escriu als logs l'enllaç de verificació: dona accés al compte.
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
      async sendNewBookingEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el aviso de reserva a ${maskEmail(to)}`);
      },
    };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass } } : {}),
  });
  const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });
  return {
    /** Avís al venedor d'una reserva confirmada amb material seu (US-12). */
    async sendNewBookingEmail({ to, sellerName, bookingNumber, startsAt, endsAt }) {
      await transport.sendMail({
        from,
        to,
        subject: `Nueva reserva ${bookingNumber} en Bloop4`,
        text: `Hola, ${sellerName}:\n\nTienes una nueva reserva confirmada (${bookingNumber}) para un evento del ${dateTime.format(new Date(startsAt))} al ${dateTime.format(new Date(endsAt))}.\n\nEntra en tu panel de Bloop4 para ver el material que debes preparar.`,
      });
    },

    async sendVerificationEmail({ to, name, link }) {
      await transport.sendMail({
        from,
        to,
        subject: 'Confirma tu correo en Bloop4',
        text: `Hola ${name}:\n\nPara activar tu cuenta, abre este enlace (caduca en 24 horas):\n${link}\n\nSi no te has registrado en Bloop4, ignora este correo.`,
      });
    },
  };
}

/** laura@example.com → l***@example.com (per als logs). */
export function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 1)}***@${domain ?? ''}`;
}
