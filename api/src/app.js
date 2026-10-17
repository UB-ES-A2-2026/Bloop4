import express from 'express';
import { catalogRouter } from './routes/catalog.js';
import { errorHandler, notFoundHandler } from './errors.js';

/**
 * Construeix l'app sense obrir ports ni connexions: el repositori s'injecta
 * per poder provar les rutes sense base de dades.
 */
export function createApp({ catalogRepository, logger = console }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', async (req, res) => {
    try {
      await catalogRepository.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api', catalogRouter(catalogRepository));
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
