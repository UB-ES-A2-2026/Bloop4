import { Router } from 'express';
import { conflictError, forbiddenError, notFoundError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';
import { EMPTY_CART } from '../repositories/cartRepository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
export const MAX_QUANTITY = 500;

function parseInstant(raw, name) {
  const date = typeof raw === 'string' && ISO_WITH_ZONE.test(raw) ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw validationError(`"${name}" debe ser una fecha ISO 8601 con zona horaria`, { field: name });
  }
  return date;
}

function parseQuantity(raw) {
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_QUANTITY) {
    throw validationError(`La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY}`, { field: 'quantity' });
  }
  return raw;
}

function parseUuid(raw, name) {
  if (typeof raw !== 'string' || !UUID.test(raw)) throw validationError(`"${name}" debe ser un UUID válido`, { field: name });
  return raw.toLowerCase();
}

/**
 * Rutes /api/cart. Només per a clients; per modificar la cistella cal el correu verificat.
 * `now` s'injecta per als tests.
 */
export function cartRouter({ cartRepository, availabilityRepository }, { now = () => new Date() } = {}) {
  const router = Router();
  router.use(requireRole('customer'));

  /** Cistella oberta del client, després de caducar-la si fa 7 dies que no es toca. */
  async function currentDraft(userId) {
    await cartRepository.expireStale(userId);
    return cartRepository.findDraft(userId);
  }

  /** 409 amb les unitats lliures si n'hi ha menys de les demanades. */
  async function checkAvailable(draft, productId, quantity) {
    const availability = await availabilityRepository.check(productId, { from: draft.startsAt, to: draft.endsAt });
    const availableUnits = availability?.availableUnits ?? 0;
    if (quantity > availableUnits) {
      throw conflictError(
        availableUnits === 0
          ? 'Este producto no está disponible en las fechas del evento'
          : availableUnits === 1
            ? 'Solo queda 1 unidad disponible en las fechas del evento'
            : `Solo quedan ${availableUnits} unidades disponibles en las fechas del evento`,
        { availableUnits },
      );
    }
  }

  /**
   * Revalida cada línia en llegir la cistella: producte retirat, preu canviat o menys unitats
   * lliures de les que es demanen. Una línia amb avisos s'ha de revisar abans de continuar.
   */
  async function withWarnings(cart) {
    let warnings = 0;
    let lines = 0;
    for (const group of cart.sellers) {
      for (const item of group.items) {
        lines++;
        item.warnings = [];
        if (item.product.status !== 'published') {
          item.warnings.push({ code: 'UNPUBLISHED' });
        } else {
          if (item.currentDailyPrice !== item.dailyPrice) item.warnings.push({ code: 'PRICE_CHANGED', currentDailyPrice: item.currentDailyPrice });
          const availability = await availabilityRepository.check(item.product.id, { from: cart.startsAt, to: cart.endsAt });
          if (item.quantity > (availability?.availableUnits ?? 0)) {
            item.warnings.push({ code: 'UNAVAILABLE', availableUnits: availability?.availableUnits ?? 0 });
          }
        }
        warnings += item.warnings.length;
      }
    }
    return { ...cart, canCheckout: lines > 0 && warnings === 0 };
  }

  const send = async (res, eventId, status = 200) =>
    res.status(status).json({ data: await withWarnings(await cartRepository.getCart(eventId)) });

  /** Línia :id de la cistella oberta del client (403 si és d'un altre, 404 si no existeix). */
  async function ownItem(req) {
    const itemId = parseUuid(req.params.id, 'id');
    const item = await cartRepository.findItem(itemId);
    if (!item) throw notFoundError('Línea no encontrada');
    if (item.customerId !== req.user.id) throw forbiddenError('Esta línea es de otra reserva');
    if (item.status !== 'draft') throw forbiddenError('Esta reserva ya no se puede modificar');
    return { itemId, ...item };
  }

  router.get('/', async (req, res) => {
    const draft = await currentDraft(req.user.id);
    if (!draft) return res.json({ data: { ...EMPTY_CART, canCheckout: false } });
    await send(res, draft.id);
  });

  router.put('/', requireActive, async (req, res) => {
    const startsAt = parseInstant(req.body?.startsAt, 'startsAt');
    const endsAt = parseInstant(req.body?.endsAt, 'endsAt');
    if (endsAt <= startsAt) throw validationError('La fecha de fin debe ser posterior a la de inicio');
    if (startsAt < now()) throw validationError('No se pueden elegir fechas pasadas');
    await cartRepository.expireStale(req.user.id);
    // Canviar les dates revalida totes les línies (els avisos surten a la resposta).
    const eventId = await cartRepository.saveDates(req.user.id, { startsAt, endsAt });
    await send(res, eventId);
  });

  router.post('/items', requireActive, async (req, res) => {
    const productId = parseUuid(req.body?.productId, 'productId');
    const quantity = parseQuantity(req.body?.quantity);
    const draft = await currentDraft(req.user.id);
    if (!draft?.startsAt) throw validationError('Elige primero las fechas del evento');
    if (!(await cartRepository.isPublished(productId))) throw notFoundError('Producto no disponible');

    // Afegir un producte que ja hi és suma les quantitats.
    const total = (await cartRepository.quantityOf(draft.id, productId)) + quantity;
    await checkAvailable(draft, productId, total);
    await cartRepository.setItem(draft.id, productId, total);
    await send(res, draft.id, 201);
  });

  // Idempotent: el cos porta la quantitat final, no un increment.
  router.patch('/items/:id', requireActive, async (req, res) => {
    const item = await ownItem(req);
    const quantity = parseQuantity(req.body?.quantity);
    await checkAvailable(await cartRepository.findDraft(req.user.id), item.productId, quantity);
    // Desar la línia també n'actualitza el preu: així el client accepta un preu canviat.
    await cartRepository.setItem(item.eventId, item.productId, quantity);
    await send(res, item.eventId);
  });

  router.delete('/items/:id', requireActive, async (req, res) => {
    const item = await ownItem(req);
    await cartRepository.deleteItem(item.eventId, item.itemId);
    res.status(204).end();
  });

  return router;
}
