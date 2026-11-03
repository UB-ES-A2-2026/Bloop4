import { Router } from 'express';
import { notFoundError, validationError } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 amb zona horària obligatòria (Z o ±hh:mm): sense zona, l'hora seria ambigua.
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// Fins a quants dies abans i després es busquen dates alternatives, i quantes se'n proposen.
const SUGGESTION_DAYS_AFTER = 14;
const SUGGESTION_DAYS_BEFORE = 7;
const MAX_SUGGESTIONS = 3;

function parseInstant(raw, name) {
  const date = typeof raw === 'string' && ISO_WITH_ZONE.test(raw) ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw validationError(`"${name}" debe ser una fecha ISO 8601 con zona horaria (p. ej. 2030-06-15T10:00:00+02:00)`, {
      [name]: raw,
    });
  }
  return date;
}

function productId(req) {
  if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { id: req.params.id });
  return req.params.id.toLowerCase();
}

/** Rutes de disponibilitat del catàleg (públiques). `now` s'injecta per als tests. */
export function availabilityRouter(repository, { now = () => new Date() } = {}) {
  const router = Router();

  /** Intervals de la mateixa durada, desplaçats dies sencers, amb alguna unitat lliure. */
  async function suggestions(id, from, to) {
    const offsets = [];
    for (let day = 1; day <= Math.max(SUGGESTION_DAYS_AFTER, SUGGESTION_DAYS_BEFORE); day++) {
      if (day <= SUGGESTION_DAYS_AFTER) offsets.push(day);
      if (day <= SUGGESTION_DAYS_BEFORE) offsets.push(-day);
    }
    const found = [];
    for (const offset of offsets) {
      const candidate = { from: new Date(from.getTime() + offset * DAY_MS), to: new Date(to.getTime() + offset * DAY_MS) };
      if (candidate.from < now()) continue;
      const result = await repository.check(id, candidate);
      if (result?.availableUnits > 0) {
        found.push({ from: candidate.from.toISOString(), to: candidate.to.toISOString(), availableUnits: result.availableUnits });
        if (found.length === MAX_SUGGESTIONS) break;
      }
    }
    return found;
  }

  router.get('/products/:id/availability', async (req, res) => {
    const id = productId(req);
    const from = parseInstant(req.query.from, 'from');
    const to = parseInstant(req.query.to, 'to');
    if (to <= from) throw validationError('La fecha de fin debe ser posterior a la de inicio');
    if (from < now()) throw validationError('No se puede consultar la disponibilidad de fechas pasadas');

    const result = await repository.check(id, { from, to });
    if (!result) throw notFoundError('Producto no encontrado');
    res.json({
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        ...result,
        suggestions: result.availableUnits > 0 ? [] : await suggestions(id, from, to),
      },
    });
  });

  router.get('/products/:id/availability/calendar', async (req, res) => {
    const id = productId(req);
    const month = req.query.month;
    if (typeof month !== 'string' || !MONTH.test(month)) {
      throw validationError('"month" debe tener el formato AAAA-MM', { month });
    }
    const unavailableDays = await repository.unavailableDays(id, month);
    if (!unavailableDays) throw notFoundError('Producto no encontrado');
    res.json({ data: { month, unavailableDays } });
  });

  return router;
}
