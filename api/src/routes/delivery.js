import { Router } from 'express';
import { ApiError, validationError } from '../errors.js';
import { requireRole } from '../auth/middleware.js';

const POSTAL_CODE = /^[0-9]{5}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;

export function parsePostalCode(raw) {
  if (typeof raw !== 'string' || !POSTAL_CODE.test(raw.trim())) {
    throw validationError('El código postal debe tener 5 dígitos', { field: 'postalCode' });
  }
  return raw.trim();
}

/** 400 OUT_OF_COVERAGE si algun venedor de la cistella no reparteix al codi postal. */
export async function checkCoverage(deliveryRepository, eventId, postalCode) {
  const uncovered = await deliveryRepository.uncoveredSellers(eventId, postalCode);
  if (uncovered.length) {
    throw new ApiError(400, 'OUT_OF_COVERAGE', 'Esta dirección está fuera de la zona de reparto', {
      sellers: uncovered.map((s) => s.legalName),
    });
  }
}

/** Una franja es pot triar si hi ha capacitat i comença com a mínim 24 h després d'ara. */
export const slotAvailable = (slot, now) => slot.hasCapacity && new Date(slot.startsAt).getTime() - now.getTime() >= MIN_NOTICE_MS;

/** GET /api/delivery-slots?postalCode=&date=: franges de 2 h per a la cistella del client. */
export function deliveryRouter({ cartRepository, deliveryRepository }, { now = () => new Date() } = {}) {
  const router = Router();

  router.get('/delivery-slots', requireRole('customer'), async (req, res) => {
    const postalCode = parsePostalCode(req.query.postalCode);
    const date = req.query.date;
    if (typeof date !== 'string' || !DATE.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
      throw validationError('"date" debe tener el formato AAAA-MM-DD', { field: 'date' });
    }
    const draft = await cartRepository.findDraft(req.user.id);
    if (!draft || (await cartRepository.getCart(draft.id)).sellers.length === 0) {
      throw validationError('Tu reserva está vacía: añade algún producto antes de elegir la entrega');
    }
    await checkCoverage(deliveryRepository, draft.id, postalCode);

    const current = now();
    const slots = (await deliveryRepository.slots(draft.id, date)).map((slot) => ({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      available: slotAvailable(slot, current),
    }));
    res.json({ data: { postalCode, date, slots } });
  });

  return router;
}
