import { forbiddenError, unauthenticatedError } from '../errors.js';
import { SESSION_COOKIE, parseCookies } from './cookies.js';
import { hashToken } from './tokens.js';

/**
 * Llegeix la cookie de sessió i, si és vàlida, deixa l'usuari a `req.user`
 * ({ id, email, fullName, status, roles, seller }). Sense sessió, `req.user` és null.
 * `findSessionUser(tokenHash)` ve del repositori d'autenticació.
 */
export function loadSession(findSessionUser) {
  return async (req, res, next) => {
    req.user = null;
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      req.sessionTokenHash = hashToken(token);
      req.user = await findSessionUser(req.sessionTokenHash);
    }
    next();
  };
}

/** 401 si no hi ha sessió. */
export function requireAuth(req, res, next) {
  if (!req.user) throw unauthenticatedError();
  next();
}

/** 401 sense sessió; 403 si el compte no està actiu (correu sense verificar o suspès). */
export function requireActive(req, res, next) {
  if (!req.user) throw unauthenticatedError();
  if (req.user.status !== 'active') {
    throw forbiddenError('Verifica tu correo electrónico para poder continuar');
  }
  next();
}

/** 401 sense sessió; 403 si l'usuari no té cap dels rols indicats. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) throw unauthenticatedError();
    if (!roles.some((role) => req.user.roles.includes(role))) throw forbiddenError();
    next();
  };
}
