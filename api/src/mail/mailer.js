import nodemailer from 'nodemailer';

/**
 * Enviament de correus de l'app. En desenvolupament, SMTP_HOST apunta a Mailpit
 * (http://localhost:8025). Sense SMTP_HOST, els correus no s'envien i només es registra un avís.
 * Mai s'escriu als logs l'enllaç de verificació: dona accés al compte.
 */
export function createMailer({
  host = process.env.SMTP_HOST,
  port = Number(process.env.SMTP_PORT ?? 1025),
  from = process.env.MAIL_FROM ?? 'Bloop4 <no-reply@bloop4.local>',
  logger = console,
} = {}) {
  if (!host) {
    return {
      async sendVerificationEmail({ to }) {
        logger.warn?.(`SMTP_HOST no configurado: no se envía el correo de verificación a ${maskEmail(to)}`);
      },
    };
  }

  const transport = nodemailer.createTransport({ host, port, secure: port === 465 });
  return {
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
