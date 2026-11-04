/** Registre dels intents d'inici de sessió, per limitar-los per compte i per IP. */

const COUNT_FAILURES = `
  SELECT count(*) FILTER (WHERE email = $1)::int AS by_email,
         count(*) FILTER (WHERE ip = $2::inet)::int AS by_ip,
         min(attempted_at) AS oldest
  FROM login_attempts
  WHERE NOT succeeded
    AND attempted_at > now() - make_interval(secs => $3)
    AND (email = $1 OR ip = $2::inet)`;

export function createLoginAttemptRepository(pool) {
  return {
    /** Intents fallits dins de la finestra, per correu i per IP, i quan va ser el més antic. */
    async countRecentFailures({ email, ip, windowSeconds }) {
      const { rows } = await pool.query(COUNT_FAILURES, [email, ip, windowSeconds]);
      return { byEmail: rows[0].by_email, byIp: rows[0].by_ip, oldest: rows[0].oldest };
    },

    async record({ email, ip, succeeded }) {
      await pool.query('INSERT INTO login_attempts (email, ip, succeeded) VALUES ($1, $2::inet, $3)', [
        email,
        ip,
        succeeded,
      ]);
    },
  };
}
