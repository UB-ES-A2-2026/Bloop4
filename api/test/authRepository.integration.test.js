// Prova l'SQL d'autenticació contra PostgreSQL amb les migracions i els seeds carregats.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createAuthRepository } from '../src/repositories/authRepository.js';
import { createLoginAttemptRepository } from '../src/repositories/loginAttemptRepository.js';
import { generateToken, hashToken } from '../src/auth/tokens.js';

const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('authRepository (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const repo = skip ? null : createAuthRepository(pool);
  const attempts = skip ? null : createLoginAttemptRepository(pool);
  // Només s'esborra el que crea aquesta execució, perquè ./db/test.sh continuï veient els seeds.
  const emails = [];
  const sessionHashes = [];
  after(async () => {
    if (!pool) return;
    const users = 'SELECT id FROM users WHERE email = ANY($1)';
    await pool.query('DELETE FROM sessions WHERE token_hash = ANY($1)', [sessionHashes]);
    for (const table of ['sessions', 'email_verification_tokens', 'terms_consents', 'user_roles', 'sellers']) {
      await pool.query(`DELETE FROM ${table} WHERE user_id IN (${users})`, [emails]);
    }
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
    await pool.query('DELETE FROM login_attempts WHERE email = ANY($1)', [emails]);
    await pool.end();
  });

  const unique = () => {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    emails.push(email);
    return email;
  };
  const verification = (ms = 60_000) => {
    const token = generateToken();
    return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ms) };
  };
  const register = (email, extra = {}) =>
    repo.registerUser({
      email,
      passwordHash: 'scrypt$1$1$1$a$b',
      fullName: 'Prova',
      role: 'customer',
      seller: null,
      termsVersion: '2026-10',
      verification: verification(),
      ...extra,
    });

  it('registra un usuari pendent amb rol i consentiment; un correu repetit → 409', async () => {
    const email = unique();
    const { id } = await register(email);
    const user = await repo.findUserByEmail(email);
    assert.equal(user.status, 'pending_verification');
    const { rows } = await pool.query(
      `SELECT (SELECT array_agg(role) FROM user_roles WHERE user_id = $1) AS roles,
              (SELECT terms_version FROM terms_consents WHERE user_id = $1) AS terms`,
      [id],
    );
    assert.deepEqual(rows[0], { roles: ['customer'], terms: '2026-10' });
    await assert.rejects(register(email), { status: 409 });
  });

  it('un venedor nou té la seva fila a sellers', async () => {
    const email = unique();
    await register(email, { role: 'seller', seller: { legalName: 'Prova S.L.', city: 'Valencia' } });
    const { rows } = await pool.query(
      'SELECT s.legal_name FROM sellers s JOIN users u ON u.id = s.user_id WHERE u.email = $1',
      [email],
    );
    assert.equal(rows[0].legal_name, 'Prova S.L.');
  });

  it('un client pot afegir-se el rol de venedor: rols i fila a sellers', async () => {
    const email = unique();
    const { id } = await register(email);
    await repo.addSellerRole(id, { legalName: 'Afegit S.L.', city: 'Valencia' });
    const { rows } = await pool.query(
      `SELECT (SELECT array_agg(role ORDER BY role) FROM user_roles WHERE user_id = $1) AS roles,
              (SELECT legal_name FROM sellers WHERE user_id = $1) AS legal_name`,
      [id],
    );
    assert.deepEqual(rows[0], { roles: ['customer', 'seller'], legal_name: 'Afegit S.L.' });
  });

  it('verifica el correu un sol cop i detecta els enllaços caducats', async () => {
    const email = unique();
    const v = verification();
    await register(email, { verification: v });
    assert.equal(await repo.verifyEmail(v.tokenHash), 'verified');
    assert.equal((await repo.findUserByEmail(email)).status, 'active');
    assert.equal(await repo.verifyEmail(v.tokenHash), 'invalid');

    const other = unique();
    const old = verification();
    const { id } = await register(other);
    await pool.query(
      `INSERT INTO email_verification_tokens (token_hash, user_id, created_at, expires_at)
       VALUES ($1, $2, now() - interval '2 days', now() - interval '1 day')`,
      [old.tokenHash, id],
    );
    assert.equal(await repo.verifyEmail(old.tokenHash), 'expired');
  });

  it('sessions: retorna l\'usuari amb rols i venedor, no si ha caducat ni després d\'esborrar-la', async () => {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = 'mobiliario@example.com'");
    const tokenHash = hashToken(generateToken());
    sessionHashes.push(tokenHash);
    await repo.createSession({ userId: rows[0].id, tokenHash, expiresAt: new Date(Date.now() + 60_000) });
    const user = await repo.findSessionUser(tokenHash);
    assert.deepEqual(user.roles, ['customer', 'seller']);
    assert.equal(user.seller.legalName, 'Mobiliario Eventos Turia S.L.');

    await repo.deleteSession(tokenHash);
    assert.equal(await repo.findSessionUser(tokenHash), null);

    const expired = hashToken(generateToken());
    sessionHashes.push(expired);
    await pool.query(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
       VALUES ($1, $2, now() - interval '2 days', now() - interval '1 day')`,
      [expired, rows[0].id],
    );
    assert.equal(await repo.findSessionUser(expired), null);
  });

  it('compta els intents fallits recents per correu i per IP', async () => {
    const email = unique();
    for (let i = 0; i < 3; i++) await attempts.record({ email, ip: '203.0.113.7', succeeded: false });
    await attempts.record({ email, ip: '203.0.113.7', succeeded: true });
    const counts = await attempts.countRecentFailures({ email, ip: '203.0.113.7', windowSeconds: 900 });
    assert.equal(counts.byEmail, 3);
    assert.ok(counts.byIp >= 3);
    assert.ok(counts.oldest instanceof Date);
  });
});
