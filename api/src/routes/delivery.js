import { Router } from 'express';
import { ApiError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';

const POSTAL_CODE = /^[0-9]{5}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const madridDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
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

function text(body, field, { max, optional = false, label }) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (!value && optional) return null;
  if (!value || value.length > max) throw validationError(`"${label}" es obligatorio (máximo ${max} caracteres)`, { field });
  return value;
}

/** Franja triada pel client: ha de ser una de les del dia, amb capacitat i amb 24 h d'antelació. */
async function chooseSlot(deliveryRepository, eventId, raw, field, now) {
  const start = typeof raw === 'string' && ISO_WITH_ZONE.test(raw) ? new Date(raw) : null;
  if (!start || Number.isNaN(start.getTime())) {
    throw validationError(`"${field}" debe ser una fecha ISO 8601 con zona horaria`, { field });
  }
  const slots = await deliveryRepository.slots(eventId, madridDate.format(start));
  const slot = slots.find((s) => new Date(s.startsAt).getTime() === start.getTime());
  if (!slot) throw validationError('Elige una de las franjas de 2 h entre las 08:00 y las 22:00', { field });
  if (!slotAvailable(slot, now)) {
    throw validationError(
      slot.hasCapacity ? 'Las entregas y recogidas se piden con al menos 24 h de antelación' : 'Esta franja ya no está disponible',
      { field },
    );
  }
  return { startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt) };
}

/**
 * GET /api/delivery-slots?postalCode=&date= (franges per a la cistella del client) i
 * PUT /api/cart/delivery (adreça i franges de lliurament i recollida).
 */
export function deliveryRouter({ cartRepository, deliveryRepository }, { now = () => new Date() } = {}) {
  const router = Router();

  router.put('/cart/delivery', requireRole('customer'), requireActive, async (req, res) => {
    const body = req.body;
    const address = {
      street: text(body, 'street', { max: 200, label: 'dirección' }),
      postalCode: parsePostalCode(body?.postalCode),
      city: text(body, 'city', { max: 80, label: 'ciudad' }),
      accessInstructions: text(body, 'accessInstructions', { max: 500, optional: true, label: 'instrucciones de acceso' }),
    };
    const draft = await cartRepository.findDraft(req.user.id);
    if (!draft || (await cartRepository.getCart(draft.id)).sellers.length === 0) {
      throw validationError('Tu reserva está vacía: añade algún producto antes de elegir la entrega');
    }
    await checkCoverage(deliveryRepository, draft.id, address.postalCode);

    const current = now();
    const deliveryWindow = await chooseSlot(deliveryRepository, draft.id, body?.deliveryStartsAt, 'deliveryStartsAt', current);
    const pickupWindow = await chooseSlot(deliveryRepository, draft.id, body?.pickupStartsAt, 'pickupStartsAt', current);
    if (deliveryWindow.endsAt > new Date(draft.startsAt)) {
      throw validationError('La entrega debe terminar antes de que empiece el evento', { field: 'deliveryStartsAt' });
    }
    if (pickupWindow.startsAt < new Date(draft.endsAt)) {
      throw validationError('La recogida debe empezar después de que termine el evento', { field: 'pickupStartsAt' });
    }

    await deliveryRepository.saveDelivery(draft.id, req.user.id, { address, deliveryWindow, pickupWindow });
    res.json({ data: await deliveryRepository.getDelivery(draft.id) });
  });

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
