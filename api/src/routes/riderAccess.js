import { Router } from 'express';
import { forbiddenError, notFoundError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id d'un servei de la URL (`/services/:id`), en minúscules. 400 si no és un UUID. */
export function parseServiceId(raw) {
  if (typeof raw !== 'string' || !UUID.test(raw)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
  return raw.toLowerCase();
}

/**
 * Davant de totes les rutes /api/rider de les històries del rider: només per a usuaris amb el rol
 * 'rider' i el perfil complet (vehicle). Deixa `req.rider` amb { userId, vehicleType }.
 */
export function requireRider({ riderRepository }) {
  return [
    requireRole('rider'),
    requireActive,
    async (req, res, next) => {
      req.rider = await riderRepository.findRider(req.user.id);
      if (!req.rider) throw forbiddenError('Tu perfil de repartidor no está completo: falta el vehículo');
      next();
    },
  ];
}

/**
 * GET /api/rider/services/:id: un servei del rider, amb l'adreça, el client i el material (el detall
 * que fan servir la llista del rider, el seguiment, les proves i el mapa). Es munta després de les
 * rutes de les històries: `/services/available` (US-14) no és l'id d'un servei.
 */
export function riderServiceRouter({ riderRepository }) {
  const router = Router();
  // Un servei d'un altre rider respon igual que un que no existeix: no se'n revela res.
  router.get('/services/:id', async (req, res) => {
    const service = await riderRepository.findMine(parseServiceId(req.params.id), req.rider.userId);
    if (!service) throw notFoundError('Servicio no encontrado');
    res.json({ data: service });
  });
  return router;
}
