import { Router } from 'express';
import { validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';
import { parseServiceId } from './riderAccess.js';

/**
 * Serveis disponibles i acceptació (US-14), sota /api/rider. Abans d'aquestes rutes, `requireRider`
 * (fonaments) ja ha comprovat el rol i ha deixat `req.rider`.
 */
export function riderAcceptanceRouter({ acceptanceRepository }) {
  const router = Router();

  // Serveis disponibles: sense dades personals del client, només la zona.
  router.get('/services/available', async (req, res) => {
    res.json({ data: await acceptanceRepository.availableServices(req.rider) });
  });

  router.post('/services/:id/accept', async (req, res) => {
    const service = await acceptanceRepository.accept(parseServiceId(req.params.id), req.rider.userId);
    res.json({ data: service });
  });

  return router;
}

/** POST /api/admin/riders: un administrador converteix un compte registrat en rider. */
export function adminRidersRouter({ acceptanceRepository }) {
  const router = Router();
  router.post('/riders', requireRole('admin'), requireActive, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const vehicleType = req.body?.vehicleType;
    if (!email) throw validationError('Indica el correo de la cuenta', { field: 'email' });
    if (typeof vehicleType !== 'string') throw validationError('Indica el vehículo', { field: 'vehicleType' });
    res.status(201).json({ data: await acceptanceRepository.createRider(email, vehicleType) });
  });
  return router;
}
