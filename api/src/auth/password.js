import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/** `scrypt$N$r$p$salt$hash` (salt i hash en base64). */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algorithm, N, r, p, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

// Hash d'una contrasenya qualsevol: si el correu no existeix, es verifica igualment contra
// aquest hash perquè el temps de resposta no reveli quins correus estan registrats.
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));
