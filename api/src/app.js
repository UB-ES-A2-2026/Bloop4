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
import { createHooks } from './hooks.js';
import { createOwnBooking } from './bookings/access.js';
import { requireRider, riderServiceRouter } from './routes/riderAccess.js';
import { bookingsRouter } from './routes/bookings.js';
// Sprint 2: cada història importa les seves rutes dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-12 ──
// ── US-08 ──
import { paymentsRouter, paymentsWebhook } from './routes/payments.js';
// ── US-14 ──
// ── US-15 ──
// ── US-09 ──
// ── US-11 ──
import { proofsRouter, riderProofsRouter, sellerServicesRouter } from './routes/proofs.js';
import { adminIncidentsRouter } from './routes/proofs.js';
import { createIncidentService } from './proofs/incidents.js';
// ── US-16 ──
// ── US-04 ──
// ── fi de les zones ──

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
 *
 * Sprint 2: `hooks`, `bookingRepository`, `riderRepository` i `notificationRepository` són dels
 * fonaments (els fan servir diverses històries). La resta de dependències del Sprint 2 arriben a
 * `deps` i cada història les fa servir des de la seva zona. Sense una dependència, la història
 * corresponent no munta les seves rutes.
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
  hooks = createHooks(),
  bookingRepository,
  riderRepository,
  notificationRepository,
  config = {},
  logger = console,
  ...deps
}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const app = express();
  app.disable('x-powered-by');
  // Darrere de Nginx (xarxa de Docker): req.ip és la IP del client, no la del proxy.
  app.set('trust proxy', ['loopback', 'uniquelocal']);

  // Rutes que necessiten el cos sense interpretar: van abans d'express.json().
  // ── US-08 ──
  // El webhook de pagaments comprova la signatura sobre el cos tal com arriba.
  if (deps.paymentService) {
    app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentsWebhook(deps.paymentService));
  }
  // ── fi de les zones ──

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

  // Sprint 2: rutes de les històries, amb el que comparteixen (vegeu mountSprint2).
  mountSprint2(app, {
    ...deps,
    hooks,
    mailer,
    logger,
    catalogRepository,
    cartRepository,
    deliveryRepository,
    bookingRepository,
    riderRepository,
    notificationRepository,
    ownBooking: bookingRepository ? createOwnBooking({ bookingRepository, hooks }) : null,
  });

  if (sellerRepository) {
    app.use('/api/seller', sellerRouter({ sellerRepository, imageStore }));
  }
  if (cartRepository) {
    // `checkoutRepository` (US-12): abans de llegir la cistella, els bloquejos caducats tornen a ser-hi.
    app.use('/api/cart', cartRouter({ cartRepository, availabilityRepository, deliveryRepository, checkoutRepository: deps.checkoutRepository }));
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

/**
 * Rutes del Sprint 2. Els fonaments munten les reserves del client (GET /api/bookings[/:id]) i, davant
 * de totes les rutes /api/rider, el rol de rider amb el vehicle (`req.rider`); `ctx.ownBooking` és la
 * reserva del client per a les rutes /api/bookings/:id/…, i `ctx.hooks` els punts d'extensió entre
 * històries (hooks.js).
 * Zones de les històries, en l'ordre en què es munten les rutes: cada història només escriu dins de
 * la seva, i sense les seves dependències no munta res.
 */
function mountSprint2(app, ctx) {
  if (ctx.ownBooking && ctx.cartRepository && ctx.deliveryRepository) app.use('/api', bookingsRouter(ctx));
  if (ctx.riderRepository) app.use('/api/rider', requireRider(ctx));
  // ── US-12 ──
  // ── US-08 ──
  if (ctx.paymentService && ctx.ownBooking) {
    const { paymentService, paymentGateway, ownBooking, hooks } = ctx;
    app.use('/api', paymentsRouter({ paymentService, gateway: paymentGateway, ownBooking }));
  }
  // ── US-14 ──
  // ── US-15 ──
  // ── US-09 ──
  // ── US-11 ──
  if (ctx.proofRepository) {
    const { proofRepository, proofStore, incidentRepository, notificationRepository, riderRepository, hooks, logger } = ctx;
    const incidentService = incidentRepository
      ? createIncidentService({
          incidentRepository,
          notificationRepository,
          // La fiança l'allibera el pagament (US-08) quan la reserva queda tancada.
          releaseDeposit: (eventId) => hooks.emit('bookingSettled', eventId),
          logger,
        })
      : null;
    if (riderRepository) {
      app.use('/api/rider', riderProofsRouter({ proofRepository, proofStore, riderRepository, incidentService, hooks }));
    }
    if (incidentService) app.use('/api/admin', adminIncidentsRouter({ incidentRepository, incidentService }));
    app.use('/api/seller', sellerServicesRouter({ proofRepository }));
    app.use('/api', proofsRouter({ proofRepository, proofStore }));
  }
  // ── US-16 ──
  // ── US-04 ──
  // ── fi de les zones ──
  // Detall d'un servei del rider (fonaments), després de les rutes de les històries: així
  // `/services/available` (US-14) no es pren per l'id d'un servei.
  if (ctx.riderRepository) app.use('/api/rider', riderServiceRouter(ctx));
}

// Un cos JSON mal format és un error del client (400), no del servidor.
function jsonSyntaxErrorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') return next(validationError('El cuerpo de la petición no es JSON válido'));
  if (err?.type === 'entity.too.large') return next(validationError('El cuerpo de la petición es demasiado grande'));
  next(err);
}
