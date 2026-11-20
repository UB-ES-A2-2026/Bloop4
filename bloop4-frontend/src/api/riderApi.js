/** Client de les rutes /api/rider (serveis de lliurament i recollida del rider). */
import { request } from './http';

/** Serveis sense rider: sense dades personals del client, només la zona. */
export async function fetchAvailableServices({ signal } = {}) {
  const { data } = await request('/rider/services/available', { signal });
  return data;
}

/** Accepta un servei; retorna el servei ja assignat, amb l'adreça i el client. */
export async function acceptService(id) {
  const { data } = await request(`/rider/services/${encodeURIComponent(id)}/accept`, { method: 'POST', shape: 'object' });
  return data;
}

/** Serveis assignats al rider: els d'un dia ('AAAA-MM-DD') o, sense data, els propers. */
export async function fetchMyServices(date, { signal } = {}) {
  const query = date ? `?${new URLSearchParams({ date })}` : '';
  const { data } = await request(`/rider/services${query}`, { signal });
  return data;
}

export async function fetchMyService(id, { signal } = {}) {
  const { data } = await request(`/rider/services/${encodeURIComponent(id)}`, { signal, shape: 'object' });
  return data;
}

/** El rider inicia un servei seu (passa a «en curso»). */
export async function startService(id) {
  const { data } = await request(`/rider/services/${encodeURIComponent(id)}/start`, { method: 'POST', shape: 'object' });
  return data;
}

/** Puja una foto de la prova d'un servei; `eventItemId` és la línia (null per a una incidència). */
export async function uploadProofPhoto(serviceId, file, eventItemId) {
  const form = new FormData();
  if (eventItemId) form.append('eventItemId', eventItemId);
  form.append('photo', file);
  const { data } = await request(`/rider/services/${encodeURIComponent(serviceId)}/photos`, { method: 'POST', body: form, shape: 'object' });
  return data;
}

export async function fetchProofPhotos(serviceId, { signal } = {}) {
  const { data } = await request(`/rider/services/${encodeURIComponent(serviceId)}/photos`, { signal });
  return data;
}

export function deleteProofPhoto(serviceId, photoId) {
  return request(`/rider/services/${encodeURIComponent(serviceId)}/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE', shape: 'none' });
}

/** Completa el servei amb el checklist: [{ eventItemId, condition, note }]. */
export async function completeService(serviceId, items) {
  const { data } = await request(`/rider/services/${encodeURIComponent(serviceId)}/complete`, { method: 'POST', body: { items }, shape: 'object' });
  return data;
}

/** Registra una incidència: { kind, description, photoId? }. */
export async function reportIncident(serviceId, incident) {
  const { data } = await request(`/rider/services/${encodeURIComponent(serviceId)}/incident`, { method: 'POST', body: incident, shape: 'object' });
  return data;
}

/** Envia la posició del rider durant un lliurament en curs: { latitude, longitude, accuracy }. */
export function sendLocation(serviceId, position) {
  return request(`/rider/services/${encodeURIComponent(serviceId)}/location`, { method: 'POST', body: position, shape: 'none' });
}
