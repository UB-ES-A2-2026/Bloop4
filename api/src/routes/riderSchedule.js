import { Router } from 'express';
import { validationError } from '../errors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Serveis assignats al rider (US-15), sota /api/rider. Abans d'aquestes rutes, `requireRider`
 * (fonaments) ja ha comprovat el rol i ha deixat `req.rider`. El detall d'un servei
 * (GET /services/:id) és dels fonaments.
 */
export function riderScheduleRouter({ riderScheduleRepository }) {
  const router = Router();

  // Serveis assignats al rider: els d'un dia (?date=AAAA-MM-DD) o, sense data, els propers.
  router.get('/services', async (req, res) => {
    const { date } = req.query;
    if (date === undefined) return res.json({ data: await riderScheduleRepository.upcoming(req.rider.userId) });
    if (typeof date !== 'string' || !DATE.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
      throw validationError('"date" debe tener el formato AAAA-MM-DD', { field: 'date' });
    }
    res.json({ data: await riderScheduleRepository.servicesOn(req.rider.userId, date) });
  });

  return router;
}
