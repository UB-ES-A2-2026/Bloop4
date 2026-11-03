import { Router } from 'express';
import { ApiError, conflictError, forbiddenError, unauthenticatedError, validationError } from '../errors.js';
import { clearSessionCookie, sessionCookie } from '../auth/cookies.js';
import { requireActive, requireAuth } from '../auth/middleware.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../auth/password.js';
import { generateToken, hashToken } from '../auth/tokens.js';
import { maskEmail } from '../mail/mailer.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// Rols que es poden triar en registrar-se; rider i admin només els assigna un administrador.
export const SELF_SERVICE_ROLES = ['customer', 'seller'];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REGISTER_MESSAGE =
  'Si el correo no estaba registrado, te hemos enviado un enlace para verificar la cuenta.';
const RESEND_MESSAGE = 'Si hay una cuenta pendiente de verificar con ese correo, te hemos enviado un enlace nuevo.';
const BAD_CREDENTIALS = 'Correo o contraseña incorrectos';

function text(body, field, { min = 1, max = 200, label = field } = {}) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (value.length < min || value.length > max) {
    throw validationError(`"${label}" debe tener entre ${min} y ${max} caracteres`, { field });
  }
  return value;
}

function email(body) {
  const value = text(body, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL.test(value)) throw validationError('"email" no es un correo válido', { field: 'email' });
  return value;
}

function password(body) {
  const value = typeof body?.password === 'string' ? body.password : '';
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    throw validationError(
      `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
      { field: 'password' },
    );
  }
  return value;
}

/**
 * Rutes /api/auth. `config`: { appUrl, cookieSecure, sessionTtlSeconds, termsVersion }.
 * Els missatges no revelen mai si un correu està registrat.
 */
export function authRouter({ authRepository, loginLimiter, mailer, config, logger }) {
  const router = Router();

  async function sendVerification(user, token) {
    const link = `${config.appUrl}/verificar?token=${token}`;
    try {
      await mailer.sendVerificationEmail({ to: user.email, name: user.fullName, link });
    } catch (err) {
      // Si falla el correu, el compte existeix igualment i es pot demanar un enllaç nou.
      logger.error({ err: err.message }, `No se pudo enviar el correo de verificación a ${maskEmail(user.email)}`);
    }
  }

  function newVerification() {
    const token = generateToken();
    return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) };
  }

  router.post('/auth/register', async (req, res) => {
    const body = req.body;
    const user = { email: email(body), fullName: text(body, 'fullName', { label: 'nombre', max: 120 }) };
    const plainPassword = password(body);
    const role = body?.role;
    if (!SELF_SERVICE_ROLES.includes(role)) {
      throw validationError('"role" debe ser "customer" o "seller"', { field: 'role' });
    }
    if (body?.acceptTerms !== true) {
      throw validationError('Debes aceptar los términos y la política de privacidad', { field: 'acceptTerms' });
    }
    const seller =
      role === 'seller'
        ? {
            legalName: text(body, 'legalName', { label: 'razón social', max: 160 }),
            city: text(body, 'city', { label: 'ciudad', max: 80 }),
          }
        : null;

    const verification = newVerification();
    try {
      await authRepository.registerUser({
        ...user,
        passwordHash: await hashPassword(plainPassword),
        role,
        seller,
        termsVersion: config.termsVersion,
        verification,
      });
      await sendVerification(user, verification.token);
    } catch (err) {
      // Correu ja registrat: es respon igual que si no ho estigués (409 només és intern).
      if (!(err instanceof ApiError && err.code === 'CONFLICT')) throw err;
    }
    res.status(201).json({ data: { message: REGISTER_MESSAGE } });
  });

  router.post('/auth/login', async (req, res) => {
    const userEmail = email(req.body);
    const plainPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    await loginLimiter.check({ email: userEmail, ip: req.ip });

    const user = await authRepository.findUserByEmail(userEmail);
    const valid = await verifyPassword(plainPassword, user?.passwordHash ?? DUMMY_HASH);
    await loginLimiter.record({ email: userEmail, ip: req.ip, succeeded: Boolean(user && valid) });
    if (!user || !valid) throw unauthenticatedError(BAD_CREDENTIALS);
    if (user.status === 'suspended') throw forbiddenError('Esta cuenta está suspendida');

    const token = generateToken();
    const tokenHash = hashToken(token);
    await authRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000),
    });
    res.set('Set-Cookie', sessionCookie(token, { maxAgeSeconds: config.sessionTtlSeconds, secure: config.cookieSecure }));
    res.json({ data: await authRepository.findSessionUser(tokenHash) });
  });

  router.post('/auth/logout', async (req, res) => {
    if (req.sessionTokenHash) await authRepository.deleteSession(req.sessionTokenHash);
    res.set('Set-Cookie', clearSessionCookie({ secure: config.cookieSecure }));
    res.status(204).end();
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ data: req.user });
  });

  // Un client pot afegir més tard el rol de venedor al mateix compte (US-13, criteri 3).
  router.post('/auth/become-seller', requireActive, async (req, res) => {
    if (req.user.roles.includes('seller')) throw conflictError('Tu cuenta ya es de empresa arrendadora');
    const seller = {
      legalName: text(req.body, 'legalName', { label: 'razón social', max: 160 }),
      city: text(req.body, 'city', { label: 'ciudad', max: 80 }),
    };
    await authRepository.addSellerRole(req.user.id, seller);
    res.json({ data: await authRepository.findSessionUser(req.sessionTokenHash) });
  });

  router.post('/auth/verify-email', async (req, res) => {
    const token = text(req.body, 'token', { max: 100 });
    const result = await authRepository.verifyEmail(hashToken(token));
    if (result === 'expired') {
      throw new ApiError(400, 'TOKEN_EXPIRED', 'El enlace ha caducado. Pide uno nuevo.');
    }
    if (result === 'invalid') {
      throw new ApiError(400, 'INVALID_TOKEN', 'El enlace no es válido o ya se ha usado.');
    }
    res.json({ data: { message: 'Correo verificado. Ya puedes iniciar sesión.' } });
  });

  router.post('/auth/resend-verification', async (req, res) => {
    const user = await authRepository.findUserByEmail(email(req.body));
    if (user?.status === 'pending_verification') {
      const verification = newVerification();
      await authRepository.createVerificationToken({ userId: user.id, ...verification });
      await sendVerification(user, verification.token);
    }
    res.json({ data: { message: RESEND_MESSAGE } });
  });

  return router;
}
