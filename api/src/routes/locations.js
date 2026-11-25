import { Router } from 'express';
import { validationError } from '../errors.js';
import { requireRole } from '../auth/middleware.js';
import { parseServiceId } from './riderAccess.js';

/** Posició enviada pel navegador del rider: { latitude, longitude, accuracy? }. */
function parseLocation(body) {
  const { latitude, longitude, accuracy } = body ?? {};
  const inRange = (value, max) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;
  if (!inRange(latitude, 90) || !inRange(longitude, 180)) {
    throw validationError('La ubicación debe tener una latitud (-90 a 90) y una longitud (-180 a 180)', { field: 'latitude' });
  }
  if (accuracy !== undefined && accuracy !== null && !(typeof accuracy === 'number' && accuracy >= 0 && accuracy < 1_000_000)) {
    throw validationError('"accuracy" debe ser un número de metros', { field: 'accuracy' });
  }
  // Sis decimals (~10 cm) són més que suficients: no se'n guarden més.
  const round = (n) => Math.round(n * 1e6) / 1e6;
  return { latitude: round(latitude), longitude: round(longitude), accuracy: accuracy ?? null };
}

/**
 * POST /api/rider/services/:id/location (el rider comparteix la posició, sota /api/rider: abans hi ha
 * `requireRider` dels fonaments).
 */
export function riderLocationRouter({ locationRepository }) {
  const router = Router();
  // Posició del rider mentre fa un lliurament (US-16). La comparteix el navegador cada 10 s.
  router.post('/services/:id/location', async (req, res) => {
    await locationRepository.record(parseServiceId(req.params.id), req.rider.userId, parseLocation(req.body));
    res.status(204).end();
  });

  return router;
}

/** GET /api/bookings/:id/locations: on són els riders dels lliuraments en curs d'una reserva del client. */
export function bookingLocationsRouter({ locationRepository, ownBooking }) {
  const router = Router();
  // El frontend ho torna a demanar cada 10 s.
  router.get('/bookings/:id/locations', requireRole('customer'), async (req, res) => {
    const booking = await ownBooking(req);
    res.set('Cache-Control', 'no-store');
    res.json({ data: await locationRepository.activeDeliveries(booking.id) });
  });
  return router;
}
