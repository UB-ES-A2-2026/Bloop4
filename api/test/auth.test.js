import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { conflictError } from '../src/errors.js';
import { hashPassword } from '../src/auth/password.js';
import { hashToken } from '../src/auth/tokens.js';

const PASSWORD = 'contrasenya1';
const PASSWORD_HASH = await hashPassword(PASSWORD);
const USER = { id: 'u1', email: 'laura@example.com', fullName: 'Laura', status: 'active', roles: ['customer'], seller: null };

// Repositoris falsos: guarden en memòria el que l'API els demana.
const state = {};
const authRepository = {
  async registerUser(input) {
    if (state.users.has(input.email)) throw conflictError('El correo ya está registrado');
    state.registered.push(input);
    return { id: 'new' };
  },
  async findUserByEmail(email) {
    return state.users.get(email) ?? null;
  },
  async findSessionUser(tokenHash) {
    return state.sessions.get(tokenHash) ?? null;
  },
  async createSession({ tokenHash }) {
    state.sessions.set(tokenHash, USER);
  },
  async deleteSession(tokenHash) {
    state.sessions.delete(tokenHash);
  },
  async createVerificationToken(input) {
    state.tokens.push(input);
  },
  async verifyEmail(tokenHash) {
    return state.verifyResults.get(tokenHash) ?? 'invalid';
  },
  async addSellerRole(userId, seller) {
    state.becameSeller = { userId, seller };
  },
};
const loginAttempts = {
  async countRecentFailures() {
    return { byEmail: state.failures, byIp: 0, oldest: new Date(Date.now() - 60_000) };
  },
  async record(attempt) {
    state.attempts.push(attempt);
  },
};
const mailer = {
  async sendVerificationEmail(mail) {
    state.mails.push(mail);
  },
};
const logged = [];
const logger = { error: (...args) => logged.push(JSON.stringify(args)), warn: (...args) => logged.push(JSON.stringify(args)) };

let server;
let base;
before(async () => {
  const app = createApp({
    catalogRepository: { ping: async () => {} },
    authRepository,
    loginAttempts,
    mailer,
    logger,
    config: { appUrl: 'http://app.test' },
  });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => {
  Object.assign(state, {
    users: new Map([
      [USER.email, { ...USER, passwordHash: PASSWORD_HASH }],
      ['pendent@example.com', { id: 'u2', email: 'pendent@example.com', fullName: 'Pendent', status: 'pending_verification', passwordHash: PASSWORD_HASH }],
      ['suspes@example.com', { id: 'u3', email: 'suspes@example.com', fullName: 'Suspès', status: 'suspended', passwordHash: PASSWORD_HASH }],
    ]),
    sessions: new Map(),
    registered: [],
    tokens: [],
    mails: [],
    attempts: [],
    failures: 0,
    verifyResults: new Map(),
    becameSeller: null,
  });
  logged.length = 0;
});

async function call(method, path, body, cookie) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    headers: res.headers,
    body: res.status === 204 ? null : await res.json(),
  };
}

const VALID = { email: '  Nou@Example.COM ', password: PASSWORD, fullName: 'Nou Client', role: 'customer', acceptTerms: true };

describe('POST /api/auth/register', () => {
  it('crea el compte amb el correu en minúscules i envia l\'enllaç de verificació', async () => {
    const { status, body } = await call('POST', '/auth/register', VALID);
    assert.equal(status, 201);
    assert.match(body.data.message, /te hemos enviado un enlace/);
    assert.equal(state.registered[0].email, 'nou@example.com');
    assert.equal(state.registered[0].termsVersion, '2026-10');
    assert.notEqual(state.registered[0].passwordHash, PASSWORD);
    const link = new URL(state.mails[0].link);
    assert.equal(link.origin + link.pathname, 'http://app.test/verificar');
    // A la BD només hi va el hash del token que viatja a l'enllaç.
    assert.equal(state.registered[0].verification.tokenHash, hashToken(link.searchParams.get('token')));
  });

  it('un correu ja registrat respon igual però no envia cap correu', async () => {
    const { status, body } = await call('POST', '/auth/register', { ...VALID, email: USER.email });
    assert.equal(status, 201);
    assert.match(body.data.message, /te hemos enviado un enlace/);
    assert.equal(state.mails.length, 0);
  });

  it('un venedor necessita la raó social i la ciutat', async () => {
    assert.equal((await call('POST', '/auth/register', { ...VALID, role: 'seller' })).status, 400);
    const ok = await call('POST', '/auth/register', { ...VALID, role: 'seller', legalName: 'Luces S.L.', city: 'Valencia' });
    assert.equal(ok.status, 201);
    assert.deepEqual(state.registered[0].seller, { legalName: 'Luces S.L.', city: 'Valencia' });
  });

  it('rebutja els rols rider i admin, contrasenyes curtes, correus no vàlids i termes sense acceptar', async () => {
    for (const body of [
      { ...VALID, role: 'rider' },
      { ...VALID, role: 'admin' },
      { ...VALID, password: '1234567' },
      { ...VALID, email: 'no-es-un-correu' },
      { ...VALID, acceptTerms: false },
      { ...VALID, acceptTerms: 'true' },
      { ...VALID, fullName: '   ' },
    ]) {
      const { status, body: res } = await call('POST', '/auth/register', body);
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(res.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(state.registered.length, 0);
  });
});

describe('POST /api/auth/login', () => {
  it('amb les credencials correctes crea la sessió amb una cookie httpOnly i SameSite=Lax', async () => {
    const { status, headers, body } = await call('POST', '/auth/login', { email: 'LAURA@example.com', password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(body.data.email, USER.email);
    const cookie = headers.get('set-cookie');
    assert.match(cookie, /^bloop4_session=[A-Za-z0-9_-]{43};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Secure/);
    assert.equal(state.attempts.at(-1).email, USER.email);
    assert.equal(state.attempts.at(-1).succeeded, true);
    assert.match(state.attempts.at(-1).ip, /127\.0\.0\.1/);
  });

  it('contrasenya incorrecta i correu inexistent donen el mateix missatge genèric', async () => {
    const wrong = await call('POST', '/auth/login', { email: USER.email, password: 'incorrecta' });
    const unknown = await call('POST', '/auth/login', { email: 'ningu@example.com', password: PASSWORD });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.body.error.message, 'Correo o contraseña incorrectos');
    assert.equal(state.attempts.filter((a) => !a.succeeded).length, 2);
  });

  it('un compte sense verificar pot entrar; un de suspès no', async () => {
    assert.equal((await call('POST', '/auth/login', { email: 'pendent@example.com', password: PASSWORD })).status, 200);
    assert.equal((await call('POST', '/auth/login', { email: 'suspes@example.com', password: PASSWORD })).status, 403);
  });

  it('després de 5 intents fallits respon 429 amb Retry-After, encara que la contrasenya sigui correcta', async () => {
    state.failures = 5;
    const { status, headers, body } = await call('POST', '/auth/login', { email: USER.email, password: PASSWORD });
    assert.equal(status, 429);
    assert.equal(body.error.code, 'TOO_MANY_REQUESTS');
    assert.ok(Number(headers.get('retry-after')) > 0);
    assert.equal(state.sessions.size, 0);
  });
});

describe('sessió: /me i /logout', () => {
  async function loggedInCookie() {
    const { headers } = await call('POST', '/auth/login', { email: USER.email, password: PASSWORD });
    return headers.get('set-cookie').split(';')[0];
  }

  it('GET /me sense sessió → 401; amb sessió retorna l\'usuari', async () => {
    assert.equal((await call('GET', '/auth/me')).status, 401);
    const { status, body } = await call('GET', '/auth/me', undefined, await loggedInCookie());
    assert.equal(status, 200);
    assert.deepEqual(body.data, USER);
  });

  it('POST /logout esborra la sessió i la cookie', async () => {
    const cookie = await loggedInCookie();
    const { status, headers } = await call('POST', '/auth/logout', undefined, cookie);
    assert.equal(status, 204);
    assert.match(headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await call('GET', '/auth/me', undefined, cookie)).status, 401);
  });
});

describe('verificació del correu', () => {
  it('token vàlid → 200; caducat → 400 TOKEN_EXPIRED; desconegut → 400 INVALID_TOKEN', async () => {
    state.verifyResults.set(hashToken('bo'), 'verified');
    state.verifyResults.set(hashToken('vell'), 'expired');
    assert.equal((await call('POST', '/auth/verify-email', { token: 'bo' })).status, 200);
    assert.equal((await call('POST', '/auth/verify-email', { token: 'vell' })).body.error.code, 'TOKEN_EXPIRED');
    assert.equal((await call('POST', '/auth/verify-email', { token: 'res' })).body.error.code, 'INVALID_TOKEN');
  });

  it('reenviar només envia correu als comptes pendents i sempre respon igual', async () => {
    const pending = await call('POST', '/auth/resend-verification', { email: 'pendent@example.com' });
    const active = await call('POST', '/auth/resend-verification', { email: USER.email });
    const unknown = await call('POST', '/auth/resend-verification', { email: 'ningu@example.com' });
    assert.deepEqual(pending.body, active.body);
    assert.deepEqual(active.body, unknown.body);
    assert.equal(state.mails.length, 1);
    assert.equal(state.tokens.length, 1);
  });
});

describe('POST /api/auth/become-seller', () => {
  const as = (user) => {
    state.sessions.set(hashToken(`tok-${user.status}-${user.roles.join()}`), user);
    return `bloop4_session=tok-${user.status}-${user.roles.join()}`;
  };

  it('un client verificat afegeix el rol de venedor amb la raó social i la ciutat', async () => {
    const { status } = await call('POST', '/auth/become-seller', { legalName: ' Luces S.L. ', city: 'Valencia' }, as(USER));
    assert.equal(status, 200);
    assert.deepEqual(state.becameSeller, { userId: 'u1', seller: { legalName: 'Luces S.L.', city: 'Valencia' } });
  });

  it('sense sessió 401; sense verificar 403; si ja és venedor 409; sense ciutat 400', async () => {
    assert.equal((await call('POST', '/auth/become-seller', { legalName: 'X S.L.', city: 'Valencia' })).status, 401);
    const pending = as({ ...USER, status: 'pending_verification' });
    assert.equal((await call('POST', '/auth/become-seller', { legalName: 'X S.L.', city: 'Valencia' }, pending)).status, 403);
    const seller = as({ ...USER, roles: ['customer', 'seller'] });
    assert.equal((await call('POST', '/auth/become-seller', { legalName: 'X S.L.', city: 'Valencia' }, seller)).status, 409);
    assert.equal((await call('POST', '/auth/become-seller', { legalName: 'X S.L.' }, as(USER))).status, 400);
    assert.equal(state.becameSeller, null);
  });
});

describe('seguretat', () => {
  it('un cos que no és JSON vàlid → 400', async () => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{x' });
    assert.equal(res.status, 400);
  });

  it('els logs no contenen ni contrasenyes ni tokens', async () => {
    mailer.sendVerificationEmail = async () => {
      throw new Error('SMTP caigut');
    };
    try {
      await call('POST', '/auth/register', VALID);
      await call('POST', '/auth/login', { email: USER.email, password: 'incorrecta' });
    } finally {
      mailer.sendVerificationEmail = async (mail) => state.mails.push(mail);
    }
    const all = logged.join('\n');
    assert.ok(all.length > 0, 'l\'error d\'SMTP s\'ha de registrar');
    assert.doesNotMatch(all, /contrasenya1|incorrecta|token=|nou@example\.com/);
  });
});
