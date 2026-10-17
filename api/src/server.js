import { createApp } from './app.js';
import { createPool } from './db.js';
import { createCatalogRepository } from './repositories/catalogRepository.js';

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
pool.on('error', (err) => console.error('Error en una conexión inactiva de PostgreSQL', err));

const app = createApp({ catalogRepository: createCatalogRepository(pool) });
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
