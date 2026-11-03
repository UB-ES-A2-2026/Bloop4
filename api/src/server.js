import path from 'node:path';
import { createApp } from './app.js';
import { createPool } from './db.js';
import { createMailer } from './mail/mailer.js';
import { createAuthRepository } from './repositories/authRepository.js';
import { createCatalogRepository } from './repositories/catalogRepository.js';
import { createLoginAttemptRepository } from './repositories/loginAttemptRepository.js';
import { createSellerRepository } from './repositories/sellerRepository.js';
import { createImageStore } from './uploads/images.js';

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
pool.on('error', (err) => console.error('Error en una conexión inactiva de PostgreSQL', err));

const app = createApp({
  catalogRepository: createCatalogRepository(pool),
  authRepository: createAuthRepository(pool),
  loginAttempts: createLoginAttemptRepository(pool),
  mailer: createMailer(),
  sellerRepository: createSellerRepository(pool),
  imageStore: createImageStore(uploadDir),
  uploadDir,
  config: {
    appUrl: process.env.APP_URL ?? 'http://localhost:8080',
    // Només per HTTPS (producció): el navegador no envia cookies Secure per HTTP.
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
});
const server = app.listen(port, () => console.log(`Bloop4 API escuchando en :${port}`));

// docker stop envia SIGTERM (i mata el procés als 10 s): es deixen acabar les peticions
// en curs, es tanquen les connexions keep-alive inactives i després el pool.
const SHUTDOWN_TIMEOUT_MS = 8_000;
function shutdown(signal) {
  console.log(`${signal} recibido, cerrando…`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    pool.end().then(
      () => process.exit(0),
      (err) => {
        console.error('Error cerrando el pool', err);
        process.exit(1);
      },
    );
  });
  server.closeIdleConnections();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
