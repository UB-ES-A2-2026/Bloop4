import path from 'node:path';
import { createApp } from './app.js';
import { createPool } from './db.js';
import { createMailer } from './mail/mailer.js';
import { createHooks } from './hooks.js';
import { createAuthRepository } from './repositories/authRepository.js';
import { createAvailabilityRepository } from './repositories/availabilityRepository.js';
import { createBookingRepository } from './repositories/bookingRepository.js';
import { createCartRepository } from './repositories/cartRepository.js';
import { createCatalogRepository } from './repositories/catalogRepository.js';
import { createDeliveryRepository } from './repositories/deliveryRepository.js';
import { createLoginAttemptRepository } from './repositories/loginAttemptRepository.js';
import { createNotificationRepository } from './repositories/notificationRepository.js';
import { createRiderRepository } from './repositories/riderRepository.js';
import { createSellerRepository } from './repositories/sellerRepository.js';
import { createImageStore } from './uploads/images.js';
// Sprint 2: cada història importa el que crea dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-12 ──
import { createCheckoutRepository } from './repositories/checkoutRepository.js';
// ── US-08 ──
import { createBookingService } from './bookings/service.js';
import { createPaymentGateway } from './payments/gateway.js';
import { createPaymentService } from './payments/service.js';
import { createPaymentRepository } from './repositories/paymentRepository.js';
// ── US-14 ──
import { createAcceptanceRepository } from './repositories/acceptanceRepository.js';
// ── US-15 ──
import { createRiderScheduleRepository } from './repositories/riderScheduleRepository.js';
// ── US-09 ──
import { createTrackingRepository } from './repositories/trackingRepository.js';
// ── US-11 ──
import { createProofStore } from './uploads/proofs.js';
import { createProofRepository } from './repositories/proofRepository.js';
import { createIncidentRepository } from './repositories/incidentRepository.js';
// ── US-16 ──
import { createLocationRepository } from './repositories/locationRepository.js';
// ── US-04 ──
import { createReviewRepository } from './repositories/reviewRepository.js';
// ── fi de les zones ──

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
pool.on('error', (err) => console.error('Error en una conexión inactiva de PostgreSQL', err));

const appUrl = process.env.APP_URL ?? 'http://localhost:8080';
const mailer = createMailer();

// Sprint 2 · fonaments: punts d'extensió i el que comparteixen les històries.
const hooks = createHooks();
const bookingRepository = createBookingRepository(pool);
// Dependències de cada història (`deps` de createApp) i tasques periòdiques (decisió del Sprint 2:
// sense servei a part; s'executen cada minut en l'ordre de les zones).
const deps = {};
const periodicTasks = [];
const startupNotes = [];
// ── US-12 ──
deps.checkoutRepository = createCheckoutRepository(pool);
// Els bloquejos de reserves que han caducat sense pagament tornen a ser la cistella.
periodicTasks.push(() => deps.checkoutRepository.releaseExpiredHolds());
// ── US-08 ──
// PAYMENT_PROVIDER: stripe (necessita STRIPE_SECRET_KEY i STRIPE_WEBHOOK_SECRET) o mock.
deps.paymentGateway = createPaymentGateway({ appUrl });
deps.paymentService = createPaymentService({
  gateway: deps.paymentGateway,
  paymentRepository: createPaymentRepository(pool),
  // Quan el pagament es completa, la reserva passa a confirmada i es fa saber (`bookingConfirmed`).
  bookingService: createBookingService({ bookingRepository, hooks }),
  mailer,
  config: { appUrl },
});
startupNotes.push(`pagos: ${deps.paymentGateway.name}`);
// Es tanquen les sessions de pagament de reserves que ja no estan pendents i es fan les retencions
// de fiança que s'havien deixat programades per a 7 dies abans del lliurament.
periodicTasks.push(() => deps.paymentService.closeStalePayments());
periodicTasks.push(() => deps.paymentService.processDueDeposits());
// ── US-14 ──
deps.acceptanceRepository = createAcceptanceRepository(pool);
// ── US-15 ──
deps.riderScheduleRepository = createRiderScheduleRepository(pool);
// ── US-09 ──
deps.trackingRepository = createTrackingRepository(pool);
// ── US-11 ──
deps.proofRepository = createProofRepository(pool);
// Fotos de les proves de lliurament: privades, fora de UPLOAD_DIR.
deps.proofStore = createProofStore(path.resolve(process.env.PROOF_DIR ?? 'proofs'));
deps.incidentRepository = createIncidentRepository(pool);
// ── US-16 ──
deps.locationRepository = createLocationRepository(pool);
// ── US-04 ──
deps.reviewRepository = createReviewRepository(pool);
// ── fi de les zones ──

const app = createApp({
  catalogRepository: createCatalogRepository(pool),
  authRepository: createAuthRepository(pool),
  loginAttempts: createLoginAttemptRepository(pool),
  mailer,
  sellerRepository: createSellerRepository(pool),
  availabilityRepository: createAvailabilityRepository(pool),
  cartRepository: createCartRepository(pool),
  deliveryRepository: createDeliveryRepository(pool),
  imageStore: createImageStore(uploadDir),
  uploadDir,
  hooks,
  bookingRepository,
  riderRepository: createRiderRepository(pool),
  notificationRepository: createNotificationRepository(pool),
  config: {
    appUrl,
    // Només per HTTPS (producció): el navegador no envia cookies Secure per HTTP.
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
  ...deps,
});
const notes = startupNotes.length ? ` (${startupNotes.join(', ')})` : '';
const server = app.listen(port, () => console.log(`Bloop4 API escuchando en :${port}${notes}`));

const HOUSEKEEPING_MS = 60_000;
const housekeeping = setInterval(async () => {
  try {
    for (const task of periodicTasks) await task();
  } catch (err) {
    console.error('Error en las tareas periódicas', err);
  }
}, HOUSEKEEPING_MS);
housekeeping.unref();

// docker stop envia SIGTERM (i mata el procés als 10 s): es deixen acabar les peticions
// en curs, es tanquen les connexions keep-alive inactives i després el pool.
const SHUTDOWN_TIMEOUT_MS = 8_000;
function shutdown(signal) {
  console.log(`${signal} recibido, cerrando…`);
  clearInterval(housekeeping);
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
