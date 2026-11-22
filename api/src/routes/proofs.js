import { Router } from 'express';
import { conflictError, forbiddenError, notFoundError, validationError } from '../errors.js';
import { requireActive, requireAuth, requireRole } from '../auth/middleware.js';
import { detectImageType } from '../uploads/images.js';
import { receivePhoto } from './seller.js';
import { parseServiceId } from './riderAccess.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONDITIONS = ['correct', 'damaged', 'incomplete'];
// Motius pels quals el rider no pot completar un servei.
const INCIDENT_KINDS = ['customer_absent', 'damaged', 'missing', 'other'];

function parseUuid(raw, field) {
  if (typeof raw !== 'string' || !UUID.test(raw)) throw validationError(`"${field}" debe ser un UUID válido`, { field });
  return raw.toLowerCase();
}

/** Checklist del cos: [{ eventItemId, condition, note }]. Si no és correcte, cal una nota. */
function parseChecklist(body) {
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 100) {
    throw validationError('Indica el estado de cada producto', { field: 'items' });
  }
  return body.items.map((item, i) => {
    const eventItemId = parseUuid(item?.eventItemId, `items[${i}].eventItemId`);
    if (!CONDITIONS.includes(item?.condition)) {
      throw validationError('El estado debe ser «Correcto», «Dañado» o «Incompleto»', { field: `items[${i}].condition` });
    }
    const note = typeof item.note === 'string' ? item.note.trim() : '';
    if (note.length > 1000) throw validationError('La explicación puede tener como máximo 1000 caracteres', { field: `items[${i}].note` });
    if (item.condition !== 'correct' && note.length < 3) {
      throw validationError('Explica qué le pasa al material dañado o incompleto', { field: `items[${i}].note` });
    }
    return { eventItemId, condition: item.condition, note: note || null };
  });
}

/**
 * Proves del rider (US-11), sota /api/rider: fotos de cada línia i finalització del servei. Abans
 * d'aquestes rutes, `requireRider` (fonaments) ja ha comprovat el rol i ha deixat `req.rider`. Cada
 * canvi d'estat es fa saber (`serviceStatusChanged`) perquè s'avisi el client.
 */
export function riderProofsRouter({ proofRepository, proofStore, riderRepository, incidentService, hooks }) {
  const router = Router();

  // Puja una foto (camp `photo`) d'una línia del servei (camp `eventItemId`).
  router.post('/services/:id/photos', receivePhoto, async (req, res) => {
    const service = await proofRepository.requireInTransit(parseServiceId(req.params.id), req.rider.userId);
    if (!req.file) throw validationError('Envía la foto en el campo "photo"', { field: 'photo' });
    const type = detectImageType(req.file.buffer);
    if (!type) throw validationError('Formato no admitido. Usa una foto JPEG, PNG o WebP.', { field: 'photo' });
    const raw = req.body?.eventItemId;
    const eventItemId = raw ? parseUuid(raw, 'eventItemId') : null;
    if (eventItemId && !service.items.some((line) => line.id === eventItemId)) {
      throw validationError('Este producto no es de este servicio', { field: 'eventItemId' });
    }

    const stored = await proofStore.save(service.id, req.file.buffer, type);
    let photo;
    try {
      photo = await proofRepository.addPhoto({ deliveryId: service.id, eventItemId, ...stored });
    } catch (err) {
      await proofStore.remove(stored.path);
      throw err;
    }
    if (!photo) {
      await proofStore.remove(stored.path);
      throw conflictError('Has llegado al máximo de fotos de este servicio');
    }
    res.status(201).json({ data: photo });
  });

  router.get('/services/:id/photos', async (req, res) => {
    const service = await proofRepository.riderService(parseServiceId(req.params.id), req.rider.userId);
    res.json({ data: await proofRepository.photos(service.id) });
  });

  router.delete('/services/:id/photos/:photoId', async (req, res) => {
    const service = await proofRepository.riderService(parseServiceId(req.params.id), req.rider.userId);
    const path = await proofRepository.deletePhoto(parseUuid(req.params.photoId, 'photoId'), service.id);
    if (!path) throw notFoundError('Foto no encontrada');
    await proofStore.remove(path);
    res.status(204).end();
  });

  // Completa el servei amb el checklist de cada línia.
  router.post('/services/:id/complete', requireActive, async (req, res) => {
    const id = parseServiceId(req.params.id);
    const items = parseChecklist(req.body);
    const result = await proofRepository.complete(id, req.rider.userId, items);
    await incidentService.afterCompletion(result);
    await hooks.emit('serviceStatusChanged', id);
    res.json({ data: await riderRepository.findMine(id, req.rider.userId) });
  });

  // El rider no pot completar el servei: registra la incidència (el servei no queda completat).
  router.post('/services/:id/incident', requireActive, async (req, res) => {
    const id = parseServiceId(req.params.id);
    const { kind } = req.body ?? {};
    if (!INCIDENT_KINDS.includes(kind)) throw validationError('Elige el motivo de la incidencia', { field: 'kind' });
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (description.length < 3 || description.length > 2000) {
      throw validationError('Explica qué ha pasado (entre 3 y 2000 caracteres)', { field: 'description' });
    }
    const photoId = req.body.photoId ? parseUuid(req.body.photoId, 'photoId') : null;
    const incident = await incidentService.report(id, req.rider.userId, { kind, description, photoId });
    await hooks.emit('serviceStatusChanged', id);
    res.status(201).json({ data: incident });
  });

  return router;
}

/**
 * GET /api/services/:id/proof (la prova d'un servei) i GET /api/proofs/photos/:id (una foto). Les
 * poden veure el rider del servei, el client de la reserva, el venedor i els administradors.
 */
export function proofsRouter({ proofRepository, proofStore }) {
  const router = Router();
  // requireAuth a cada ruta, no amb router.use: aquest router es munta a /api i, si no, demanaria
  // sessió a totes les rutes públiques que van darrere (el catàleg).
  router.get('/services/:id/proof', requireAuth, async (req, res) => {
    const id = parseServiceId(req.params.id);
    if (!(await proofRepository.canView(id, req.user))) throw notFoundError('Servicio no encontrado');
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await proofRepository.proof(id) });
  });

  router.get('/proofs/photos/:id', requireAuth, async (req, res) => {
    const photo = await proofRepository.findPhoto(parseUuid(req.params.id, 'id'));
    // Una foto que no es pot veure respon igual que una que no existeix.
    if (!photo || !(await proofRepository.canView(photo.deliveryId, req.user))) throw notFoundError('Foto no encontrada');
    res.set({ 'Content-Type': photo.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(await proofStore.read(photo.path));
  });

  return router;
}

/** GET /api/seller/services: serveis del venedor de la sessió, per consultar-ne les proves. */
export function sellerServicesRouter({ proofRepository }) {
  const router = Router();
  router.get('/services', requireRole('seller'), async (req, res) => {
    if (!req.user.seller) throw forbiddenError('Tu cuenta no tiene perfil de vendedor');
    res.json({ data: await proofRepository.sellerServices(req.user.seller.id) });
  });
  return router;
}

/** GET /api/admin/incidents i POST /api/admin/incidents/:id/resolve (rol admin). */
export function adminIncidentsRouter({ incidentRepository, incidentService }) {
  const router = Router();
  router.use('/incidents', requireRole('admin'), requireActive);

  router.get('/incidents', async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['open', 'resolved'].includes(status)) {
      throw validationError('"status" debe ser open o resolved', { field: 'status' });
    }
    res.json({ data: await incidentRepository.list({ status }) });
  });

  router.post('/incidents/:id/resolve', async (req, res) => {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length < 3 || note.length > 1000) throw validationError('Explica cómo se ha resuelto (entre 3 y 1000 caracteres)', { field: 'note' });
    const result = await incidentService.resolve(parseUuid(req.params.id, 'id'), req.user.id, note);
    res.json({ data: { resolved: true, bookingCompleted: result.completed, openIncidents: result.openIncidents } });
  });

  return router;
}
