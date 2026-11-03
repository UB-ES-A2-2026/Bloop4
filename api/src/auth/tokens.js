import { createHash, randomBytes } from 'node:crypto';

/** Token aleatori de 256 bits, apte per a URL i cookies. Només el veu el client. */
export function generateToken() {
  return randomBytes(32).toString('base64url');
}

/** El que es guarda a la BD: el hash SHA-256 del token, mai el token. */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
