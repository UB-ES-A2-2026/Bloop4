/**
 * Accés a usuaris, sessions i tokens de verificació. Igual que el repositori del catàleg,
 * és l'única capa que coneix l'esquema SQL i retorna objectes amb la forma del contracte JSON.
 */
import { conflictError } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

// Usuari d'una sessió vigent, amb els seus rols i el seu perfil de venedor (si en té).
const SESSION_USER = `
  SELECT u.id, u.email, u.full_name, u.status,
         coalesce(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
         se.id AS seller_id, se.legal_name AS seller_legal_name, se.city AS seller_city
  FROM sessions s
  JOIN users u           ON u.id = s.user_id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN sellers se    ON se.user_id = u.id
  WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status <> 'suspended'
  GROUP BY u.id, se.id`;

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    roles: row.roles,
    seller: row.seller_id ? { id: row.seller_id, legalName: row.seller_legal_name, city: row.seller_city } : null,
  };
}

async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function createAuthRepository(pool) {
  return {
    /**
     * Crea l'usuari pendent de verificar amb el seu rol, el perfil de venedor (si cal), el
     * consentiment dels termes i el token de verificació. Si el correu ja existeix, 409.
     */
    async registerUser({ email, passwordHash, fullName, role, seller, termsVersion, verification }) {
      return inTransaction(pool, async (client) => {
        let userId;
        try {
          const { rows } = await client.query(
            'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
            [email, passwordHash, fullName],
          );
          userId = rows[0].id;
        } catch (err) {
          if (err.code === UNIQUE_VIOLATION) throw conflictError('El correo ya está registrado');
          throw err;
        }
        await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);
        if (seller) {
          await client.query('INSERT INTO sellers (legal_name, city, user_id) VALUES ($1, $2, $3)', [
            seller.legalName,
            seller.city,
            userId,
          ]);
        }
        await client.query('INSERT INTO terms_consents (user_id, terms_version) VALUES ($1, $2)', [userId, termsVersion]);
        await client.query(
          'INSERT INTO email_verification_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
          [verification.tokenHash, userId, verification.expiresAt],
        );
        return { id: userId };
      });
    },

    /** Afegeix el rol de venedor a un usuari que ja existeix i en crea el perfil (fila de sellers). */
    async addSellerRole(userId, { legalName, city }) {
      await inTransaction(pool, async (client) => {
        await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'seller')", [userId]);
        await client.query('INSERT INTO sellers (legal_name, city, user_id) VALUES ($1, $2, $3)', [legalName, city, userId]);
      });
    },

    /** Dades per iniciar sessió o reenviar la verificació. null si el correu no existeix. */
    async findUserByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, email, full_name, status, password_hash FROM users WHERE email = $1',
        [email],
      );
      const row = rows[0];
      return row
        ? { id: row.id, email: row.email, fullName: row.full_name, status: row.status, passwordHash: row.password_hash }
        : null;
    },

    async findSessionUser(tokenHash) {
      const { rows } = await pool.query(SESSION_USER, [tokenHash]);
      return rows.length ? toUser(rows[0]) : null;
    },

    async createSession({ userId, tokenHash, expiresAt }) {
      await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
        tokenHash,
        userId,
        expiresAt,
      ]);
    },

    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    },

    async createVerificationToken({ userId, tokenHash, expiresAt }) {
      await pool.query('INSERT INTO email_verification_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
        tokenHash,
        userId,
        expiresAt,
      ]);
    },

    /**
     * Fa servir un token de verificació i activa el compte.
     * @returns {Promise<'verified' | 'expired' | 'invalid'>}
     */
    async verifyEmail(tokenHash) {
      return inTransaction(pool, async (client) => {
        const { rows } = await client.query(
          `SELECT user_id, expires_at <= now() AS expired
           FROM email_verification_tokens
           WHERE token_hash = $1 AND used_at IS NULL
           FOR UPDATE`,
          [tokenHash],
        );
        if (rows.length === 0) return 'invalid';
        if (rows[0].expired) return 'expired';
        await client.query('UPDATE email_verification_tokens SET used_at = now() WHERE token_hash = $1', [tokenHash]);
        await client.query(
          `UPDATE users SET status = 'active', email_verified_at = now()
           WHERE id = $1 AND status = 'pending_verification'`,
          [rows[0].user_id],
        );
        return 'verified';
      });
    },
  };
}
