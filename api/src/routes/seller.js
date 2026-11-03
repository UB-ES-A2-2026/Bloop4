import { Router } from 'express';
import multer from 'multer';
import { conflictError, forbiddenError, notFoundError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';
import { MAX_IMAGES_PER_PRODUCT, MAX_IMAGE_BYTES, detectImageType } from '../uploads/images.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
const MEASURE = /^\d{1,6}(\.\d{1,2})?$/;
export const MAX_UNITS = 500;
const MAX_SPECS = 30;

/** Valida i normalitza els camps del cos. Només retorna els que hi són. */
function parseFields(body, { creating }) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('El cuerpo debe ser un objeto JSON');
  }
  const fields = {};
  const has = (key) => body[key] !== undefined;
  const fail = (field, message) => {
    throw validationError(message, { field });
  };

  if (creating || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 3 || name.length > 120) fail('name', 'El nombre debe tener entre 3 y 120 caracteres');
    fields.name = name;
  }
  if (creating || has('categoryId')) {
    if (typeof body.categoryId !== 'string' || !UUID.test(body.categoryId)) fail('categoryId', 'Elige una categoría válida');
    fields.categoryId = body.categoryId.toLowerCase();
  }
  for (const key of ['dailyPrice', 'depositAmount']) {
    if (creating && key === 'dailyPrice' && !has(key)) fail(key, 'Indica el precio por día');
    if (has(key)) {
      const value = String(body[key]).trim();
      if (!MONEY.test(value)) fail(key, `"${key}" debe ser un importe con hasta 2 decimales (p. ej. 45.00)`);
      fields[key] = value;
    }
  }
  for (const key of ['description', 'insurance']) {
    if (has(key)) {
      const value = body[key] === null ? '' : String(body[key]).trim();
      if (value.length > 2000) fail(key, `"${key}" puede tener como máximo 2000 caracteres`);
      fields[key] = value === '' ? null : value;
    }
  }
  if (has('specs')) {
    const specs = body.specs;
    if (specs === null || typeof specs !== 'object' || Array.isArray(specs)) fail('specs', 'Las especificaciones deben ser un objeto');
    const entries = Object.entries(specs).map(([k, v]) => [String(k).trim(), String(v ?? '').trim()]).filter(([k, v]) => k && v);
    if (entries.length > MAX_SPECS || entries.some(([k, v]) => k.length > 50 || v.length > 100)) {
      fail('specs', `Como máximo ${MAX_SPECS} especificaciones, con nombres de 50 y valores de 100 caracteres`);
    }
    fields.specs = Object.fromEntries(entries);
  }
  for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) {
    if (has(key)) {
      if (body[key] === null) {
        fields[key] = null;
        continue;
      }
      const value = String(body[key]).trim();
      if (!MEASURE.test(value) || Number(value) <= 0) fail(key, `"${key}" debe ser un número mayor que 0`);
      fields[key] = value;
    }
  }
  if (has('units')) {
    if (!Number.isInteger(body.units) || body.units < 0 || body.units > MAX_UNITS) {
      fail('units', `Las unidades deben ser un número entero entre 0 y ${MAX_UNITS}`);
    }
    fields.units = body.units;
  }
  return fields;
}

/** Camps que falten per poder publicar (US-10, criteri 3). */
export function missingForPublish(product) {
  const missing = [];
  if (!product.name) missing.push('name');
  if (!product.category) missing.push('categoryId');
  if (product.images.length === 0) missing.push('images');
  if (!(Number(product.dailyPrice) > 0)) missing.push('dailyPrice');
  if (!(product.units >= 1)) missing.push('units');
  for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) {
    if (!(Number(product[key]) > 0)) missing.push(key);
  }
  return missing;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 } });

/** Llegeix la foto del camp `photo` i converteix els errors de multer en 400. */
function receivePhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(validationError('La foto supera el máximo de 10 MB'));
    if (err instanceof multer.MulterError) return next(validationError('Envía una sola foto en el campo "photo"'));
    next(err);
  });
}

/** Rutes /api/seller: el venedor gestiona els seus productes. */
export function sellerRouter({ sellerRepository, imageStore }) {
  const router = Router();
  router.use(requireRole('seller'));

  function sellerId(req) {
    if (!req.user.seller) throw forbiddenError('Tu cuenta no tiene una empresa asociada');
    return req.user.seller.id;
  }

  /** Comprova que :id és un producte del venedor (404 si no existeix, 403 si és d'un altre). */
  async function ownProductId(req) {
    const { id } = req.params;
    if (!UUID.test(id)) throw validationError('"id" debe ser un UUID válido', { id });
    const owner = await sellerRepository.getProductSellerId(id.toLowerCase());
    if (!owner) throw notFoundError('Producto no encontrado');
    if (owner !== sellerId(req)) throw forbiddenError('Este producto es de otra empresa');
    return id.toLowerCase();
  }

  async function checkCategory(fields) {
    if (fields.categoryId && !(await sellerRepository.categoryExists(fields.categoryId))) {
      throw validationError('La categoría no existe', { field: 'categoryId' });
    }
  }

  router.get('/products', async (req, res) => {
    res.json({ data: await sellerRepository.listProducts(sellerId(req)) });
  });

  router.get('/products/:id', async (req, res) => {
    res.json({ data: await sellerRepository.getProduct(await ownProductId(req)) });
  });

  router.post('/products', requireActive, async (req, res) => {
    const fields = parseFields(req.body, { creating: true });
    await checkCategory(fields);
    res.status(201).json({ data: await sellerRepository.createProduct(sellerId(req), fields) });
  });

  router.patch('/products/:id', requireActive, async (req, res) => {
    const id = await ownProductId(req);
    const fields = parseFields(req.body, { creating: false });
    await checkCategory(fields);
    res.json({ data: await sellerRepository.updateProduct(sellerId(req), id, fields) });
  });

  router.post('/products/:id/publish', requireActive, async (req, res) => {
    const id = await ownProductId(req);
    const seller = await sellerRepository.getSeller(sellerId(req));
    if (!seller.verified) {
      throw forbiddenError('Tu empresa todavía no está verificada. Podrás publicar cuando la verifiquemos.');
    }
    const product = await sellerRepository.getProduct(id);
    const missing = missingForPublish(product);
    if (missing.length) throw validationError('Faltan datos para publicar el producto', { missing });
    res.json({ data: await sellerRepository.publishProduct(id) });
  });

  router.post('/products/:id/images', requireActive, receivePhoto, async (req, res) => {
    const id = await ownProductId(req);
    if (!req.file) throw validationError('Envía la foto en el campo "photo"');
    const type = detectImageType(req.file.buffer);
    if (!type) throw validationError('Formato no admitido. Usa una foto JPEG, PNG o WebP.');

    const product = await sellerRepository.getProduct(id);
    const path = await imageStore.save(id, req.file.buffer, type);
    let image;
    try {
      image = await sellerRepository.addImage(id, { path, altText: product.name }, MAX_IMAGES_PER_PRODUCT);
    } catch (err) {
      await imageStore.remove(path);
      throw err;
    }
    if (!image) {
      await imageStore.remove(path);
      throw conflictError(`Un producto puede tener como máximo ${MAX_IMAGES_PER_PRODUCT} fotos`);
    }
    res.status(201).json({ data: image });
  });

  router.delete('/products/:id/images/:imageId', requireActive, async (req, res) => {
    const id = await ownProductId(req);
    if (!UUID.test(req.params.imageId)) throw validationError('"imageId" debe ser un UUID válido');
    const path = await sellerRepository.deleteImage(id, req.params.imageId.toLowerCase());
    if (!path) throw notFoundError('Foto no encontrada');
    await imageStore.remove(path);
    res.status(204).end();
  });

  return router;
}
