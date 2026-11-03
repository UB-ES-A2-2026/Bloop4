import { Router } from 'express';
import { forbiddenError, notFoundError, validationError } from '../errors.js';
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
export function cartRouter({ cartRepository }, { now = () => new Date() } = {}) {
  const router = Router();
  router.use(requireRole('customer'));

  const send = async (res, eventId, status = 200) => res.status(status).json({ data: await cartRepository.getCart(eventId) });

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
    const draft = await cartRepository.findDraft(req.user.id);
    if (!draft) return res.json({ data: EMPTY_CART });
    await send(res, draft.id);
  });

  router.put('/', requireActive, async (req, res) => {
    const startsAt = parseInstant(req.body?.startsAt, 'startsAt');
    const endsAt = parseInstant(req.body?.endsAt, 'endsAt');
    if (endsAt <= startsAt) throw validationError('La fecha de fin debe ser posterior a la de inicio');
    if (startsAt < now()) throw validationError('No se pueden elegir fechas pasadas');
    const eventId = await cartRepository.saveDates(req.user.id, { startsAt, endsAt });
    await send(res, eventId);
  });

  router.post('/items', requireActive, async (req, res) => {
    const productId = parseUuid(req.body?.productId, 'productId');
    const quantity = parseQuantity(req.body?.quantity);
    const draft = await cartRepository.findDraft(req.user.id);
    if (!draft?.startsAt) throw validationError('Elige primero las fechas del evento');
    if (!(await cartRepository.isPublished(productId))) throw notFoundError('Producto no disponible');

    // Afegir un producte que ja hi és suma les quantitats.
    const total = (await cartRepository.quantityOf(draft.id, productId)) + quantity;
    await cartRepository.setItem(draft.id, productId, total);
    await send(res, draft.id, 201);
  });

  // Idempotent: el cos porta la quantitat final, no un increment.
  router.patch('/items/:id', requireActive, async (req, res) => {
    const item = await ownItem(req);
    const quantity = parseQuantity(req.body?.quantity);
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
