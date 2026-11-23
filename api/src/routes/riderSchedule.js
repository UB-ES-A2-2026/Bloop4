import { Router } from 'express';
import { validationError } from '../errors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una data 'AAAA-MM-DD' que existeix al calendari. `new Date` no garanteix que el dia existeixi (pot
 * convertir el 31/02 en el 3/03) i PostgreSQL no té l'any 0: si arribessin a la consulta,
 * respondrien 500 en lloc de 400. Per això la data ha de sortir igual després de passar per `Date`.
 */
function isCalendarDate(raw) {
  if (typeof raw !== 'string' || !DATE.test(raw) || raw.startsWith('0000')) return false;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

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
    if (!isCalendarDate(date)) {
      throw validationError('"date" debe tener el formato AAAA-MM-DD', { field: 'date' });
    }
    res.json({ data: await riderScheduleRepository.servicesOn(req.rider.userId, date) });
  });

  return router;
}
