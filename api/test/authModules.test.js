import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { parseCookies, sessionCookie } from '../src/auth/cookies.js';
import { generateToken, hashToken } from '../src/auth/tokens.js';
import { createLoginLimiter } from '../src/auth/loginLimiter.js';
import { requireActive, requireRole } from '../src/auth/middleware.js';
import { maskEmail } from '../src/mail/mailer.js';

describe('contrasenyes (scrypt)', () => {
  it('el hash no conté la contrasenya i només la contrasenya correcta el verifica', async () => {
    const hash = await hashPassword('secreta123');
    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!hash.includes('secreta123'));
    assert.equal(await verifyPassword('secreta123', hash), true);
    assert.equal(await verifyPassword('Secreta123', hash), false);
  });

  it('dos hashes de la mateixa contrasenya són diferents (salt aleatori)', async () => {
    assert.notEqual(await hashPassword('x'.repeat(8)), await hashPassword('x'.repeat(8)));
  });

  it('un hash mal format no verifica res', async () => {
    assert.equal(await verifyPassword('a', 'bcrypt$x'), false);
  });
});

describe('cookies i tokens', () => {
  it('parseja la capçalera Cookie i ignora valors mal codificats', () => {
    assert.deepEqual(parseCookies('a=1; bloop4_session=x%2By; mal=%E0%A4%A'), { a: '1', bloop4_session: 'x+y' });
  });

  it('la cookie de sessió porta Secure només si es demana', () => {
    assert.match(sessionCookie('t', { maxAgeSeconds: 10, secure: true }), /; Secure$/);
  });

  it('els tokens són aleatoris i el hash és SHA-256 en hex', () => {
    assert.notEqual(generateToken(), generateToken());
    assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
  });

  it('emmascara el correu per als logs', () => {
    assert.equal(maskEmail('laura@example.com'), 'l***@example.com');
  });
});

describe('límit d\'intents', () => {
  const limiter = (counts) => createLoginLimiter({ countRecentFailures: async () => counts, record: async () => {} });

  it('deixa passar amb 4 fallits i bloqueja amb 5 (per correu o per IP)', async () => {
    await limiter({ byEmail: 4, byIp: 4, oldest: new Date() }).check({ email: 'a', ip: '1.1.1.1' });
    await assert.rejects(limiter({ byEmail: 5, byIp: 0, oldest: new Date() }).check({}), { status: 429 });
    await assert.rejects(limiter({ byEmail: 0, byIp: 5, oldest: new Date() }).check({}), { status: 429 });
  });

  it('Retry-After és el temps que falta perquè caduqui l\'intent més antic', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await assert.rejects(limiter({ byEmail: 5, byIp: 0, oldest: tenMinutesAgo }).check({}), (err) => {
      assert.ok(err.retryAfter > 290 && err.retryAfter <= 300, String(err.retryAfter));
      return true;
    });
  });
});

describe('middlewares de rol', () => {
  const run = (middleware, user) => {
    try {
      middleware({ user }, {}, () => {});
      return 'next';
    } catch (err) {
      return err.status;
    }
  };

  it('requireRole: 401 sense sessió, 403 sense el rol, next amb el rol', () => {
    const sellerOnly = requireRole('seller');
    assert.equal(run(sellerOnly, null), 401);
    assert.equal(run(sellerOnly, { roles: ['customer'] }), 403);
    assert.equal(run(sellerOnly, { roles: ['customer', 'seller'] }), 'next');
  });

  it('requireActive: un compte sense verificar no pot continuar (403)', () => {
    assert.equal(run(requireActive, { status: 'pending_verification' }), 403);
    assert.equal(run(requireActive, { status: 'active' }), 'next');
  });
});
