import express from 'express';
import { catalogRouter } from './routes/catalog.js';
import { authRouter } from './routes/auth.js';
import { availabilityRouter } from './routes/availability.js';
import { cartRouter } from './routes/cart.js';
import { deliveryRouter } from './routes/delivery.js';
import { sellerRouter } from './routes/seller.js';
import { loadSession } from './auth/middleware.js';
import { createLoginLimiter } from './auth/loginLimiter.js';
import { errorHandler, notFoundHandler, validationError } from './errors.js';

export const DEFAULT_CONFIG = {
  appUrl: 'http://localhost:8080',
  cookieSecure: false,
  sessionTtlSeconds: 7 * 24 * 60 * 60,
  termsVersion: '2026-10',
};

/**
 * Construeix l'app sense obrir ports ni connexions: els repositoris i el servei de correu
 * s'injecten per poder provar les rutes sense base de dades ni SMTP. Sense `authRepository`
 * no es munten les rutes d'autenticació i cap petició té sessió.
 */
export function createApp({
  catalogRepository,
  authRepository,
  loginAttempts,
  mailer,
  sellerRepository,
  availabilityRepository,
  cartRepository,
  deliveryRepository,
  imageStore,
  uploadDir,
  config = {},
  logger = console,
}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const app = express();
  app.disable('x-powered-by');
  // Darrere de Nginx (xarxa de Docker): req.ip és la IP del client, no la del proxy.
  app.set('trust proxy', ['loopback', 'uniquelocal']);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (req, res) => {
    try {
      await catalogRepository.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  if (authRepository) {
    app.use(loadSession(authRepository.findSessionUser));
    app.use(
      '/api',
      authRouter({
        authRepository,
        loginLimiter: createLoginLimiter(loginAttempts),
        mailer,
        config: settings,
        logger,
      }),
    );
  } else {
    app.use((req, res, next) => {
      req.user = null;
      next();
    });
  }

  if (sellerRepository) {
    app.use('/api/seller', sellerRouter({ sellerRepository, imageStore }));
  }
  if (cartRepository) {
    app.use('/api/cart', cartRouter({ cartRepository, availabilityRepository, deliveryRepository }));
  }
  if (cartRepository && deliveryRepository) {
    app.use('/api', deliveryRouter({ cartRepository, deliveryRepository }));
  }
  if (availabilityRepository) {
    app.use('/api', availabilityRouter(availabilityRepository));
  }
  app.use('/api', catalogRouter(catalogRepository));
  // Sense Nginx (npm run dev), l'API mateixa serveix les fotos pujades.
  if (uploadDir) {
    app.use(
      '/uploads',
      express.static(uploadDir, {
        index: false,
        dotfiles: 'deny',
        setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
      }),
    );
  }
  app.use(notFoundHandler);
  app.use(jsonSyntaxErrorHandler);
  app.use(errorHandler(logger));
  return app;
}

// Un cos JSON mal format és un error del client (400), no del servidor.
function jsonSyntaxErrorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') return next(validationError('El cuerpo de la petición no es JSON válido'));
  if (err?.type === 'entity.too.large') return next(validationError('El cuerpo de la petición es demasiado grande'));
  next(err);
}
