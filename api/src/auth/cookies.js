export const SESSION_COOKIE = 'bloop4_session';

/** `Cookie: a=1; b=2` → { a: '1', b: '2' }. Els valors mal codificats s'ignoren. */
export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Valor mal codificat: es descarta.
    }
  }
  return cookies;
}

/**
 * Cookie de sessió: httpOnly (JavaScript no la pot llegir), SameSite=Lax (no s'envia en
 * peticions POST d'altres webs) i Secure quan l'app es serveix per HTTPS.
 */
export function sessionCookie(token, { maxAgeSeconds, secure }) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie({ secure }) {
  return sessionCookie('', { maxAgeSeconds: 0, secure });
}
