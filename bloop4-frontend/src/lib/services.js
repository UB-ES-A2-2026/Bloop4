/** Textos dels serveis de lliurament i recollida. */

export const SERVICE_TYPE_LABEL = { delivery: 'Entrega', pickup: 'Recogida' };

/** Estat d'un servei assignat, tal com el veu el rider. */
export const SERVICE_STATUS_LABEL = {
  assigned: 'Pendiente',
  in_transit: 'En curso',
  delivered: 'Completado',
  incident: 'Incidencia',
  cancelled: 'Cancelado',
};

export const CONDITION_LABEL = { correct: 'Correcto', damaged: 'Dañado', incomplete: 'Incompleto' };

export const INCIDENT_KIND_LABEL = {
  customer_absent: 'El cliente no está',
  damaged: 'Material dañado',
  missing: 'Falta material',
  other: 'Otro motivo',
};

/** Enllaç per obrir l'adreça en una aplicació de mapes (al mòbil obre l'app instal·lada). */
export function mapsUrl({ street, postalCode, city }) {
  const query = `${street}, ${postalCode} ${city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Data ('AAAA-MM-DD') en hora local del navegador; per defecte, la d'avui. */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Resum del material: "3 × Altavoz activo · 1 × Carpa jaima". */
export const itemsSummary = (items) => items.map((i) => `${i.quantity} × ${i.name}`).join(' · ');
