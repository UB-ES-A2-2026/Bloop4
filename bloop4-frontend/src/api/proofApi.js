/** Client de les proves de lliurament: les poden veure el rider, el client, el venedor i l'administrador. */
import { request } from './http';

export async function fetchProof(serviceId, { signal } = {}) {
  const { data } = await request(`/services/${encodeURIComponent(serviceId)}/proof`, { signal, shape: 'object' });
  return data;
}

/** Serveis del venedor de la sessió amb si tenen prova i incidències obertes. */
export async function fetchSellerServices({ signal } = {}) {
  const { data } = await request('/seller/services', { signal });
  return data;
}
