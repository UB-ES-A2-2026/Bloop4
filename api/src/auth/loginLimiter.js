import { tooManyRequestsError } from '../errors.js';

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_SECONDS = 15 * 60;

/**
 * Bloqueja l'inici de sessió durant 15 minuts després de 5 intents fallits amb el mateix
 * correu o des de la mateixa IP. Els intents es compten a PostgreSQL (login_attempts).
 */
export function createLoginLimiter(attempts, { maxFailures = MAX_FAILED_ATTEMPTS, windowSeconds = WINDOW_SECONDS } = {}) {
  return {
    /** Llança 429 si el correu o la IP ja han superat el límit. */
    async check({ email, ip }) {
      const { byEmail, byIp, oldest } = await attempts.countRecentFailures({ email, ip, windowSeconds });
      if (byEmail >= maxFailures || byIp >= maxFailures) {
        const elapsed = oldest ? Math.floor((Date.now() - new Date(oldest).getTime()) / 1000) : 0;
        const retryAfter = Math.max(1, windowSeconds - elapsed);
        throw tooManyRequestsError(
          'Demasiados intentos fallidos. Vuelve a intentarlo dentro de 15 minutos.',
          retryAfter,
        );
      }
    },

    record: ({ email, ip, succeeded }) => attempts.record({ email, ip, succeeded }),
  };
}
