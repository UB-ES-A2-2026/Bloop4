import { Router } from 'express';
import { validationError } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CATEGORY_IDS = 50;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 10_000;

// Només dígits: Number() acceptaria "1e300", "0x2" o "1.0".
function parsePositiveInt(raw, name, { fallback, max }) {
  if (raw === undefined) return fallback;
  const value = /^\d{1,9}$/.test(String(raw)) ? Number(raw) : NaN;
  if (!(value >= 1 && value <= max)) {
    throw validationError(`"${name}" debe ser un entero entre 1 y ${max}`, { [name]: raw });
  }
  return value;
}

/** `?categoryId=a,b` (o `?categoryId=a&categoryId=b`) → ['a', 'b'] | null */
function parseCategoryIds(raw) {
  if (raw === undefined) return null;
  const ids = [raw].flat().flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
  if (ids.length === 0) return null;
  if (ids.length > MAX_CATEGORY_IDS) {
    throw validationError(`Como máximo ${MAX_CATEGORY_IDS} categorías por consulta`);
  }
  const invalid = ids.filter((id) => !UUID.test(id));
  if (invalid.length > 0) {
    throw validationError('"categoryId" debe contener UUIDs válidos', { invalid });
  }
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

/** `?q=` → text retallat entre 2 i 100 caràcters | null si no hi ha cerca. */
function parseSearch(raw) {
  if (raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw validationError('"q" solo puede aparecer una vez');
  }
  const q = raw.trim();
  if (q.length < SEARCH_MIN_LENGTH || q.length > SEARCH_MAX_LENGTH) {
    throw validationError(
      `"q" debe tener entre ${SEARCH_MIN_LENGTH} y ${SEARCH_MAX_LENGTH} caracteres`,
      { q: raw },
    );
  }
  return q;
}

export function catalogRouter(repository) {
  const router = Router();

  router.get('/categories', async (req, res) => {
    res.json({ data: await repository.listCategories() });
  });

  router.get('/products', async (req, res) => {
    const categoryIds = parseCategoryIds(req.query.categoryId);
    const q = parseSearch(req.query.q);
    const page = parsePositiveInt(req.query.page, 'page', { fallback: 1, max: MAX_PAGE });
    const pageSize = parsePositiveInt(req.query.pageSize, 'pageSize', {
      fallback: DEFAULT_PAGE_SIZE,
      max: MAX_PAGE_SIZE,
    });

    const { items, totalItems } = await repository.listProducts({
      categoryIds,
      q,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({
      data: items,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    });
  });

  return router;
}
