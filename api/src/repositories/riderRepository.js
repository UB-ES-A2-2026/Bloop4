/**
 * Riders i serveis (esquema comú del Sprint 2). Un servei és una fila de `deliveries` d'una reserva
 * confirmada. Aquí hi ha el que fan servir totes les històries del rider: el seu perfil i com veu un
 * servei seu. Les dades personals del client (adreça completa, nom, instruccions) només surten per al
 * rider que té el servei assignat.
 */

// Material del servei: els productes del venedor d'aquell servei dins de la reserva.
export const ITEMS = `
  (SELECT coalesce(json_agg(json_build_object('eventItemId', ei.id, 'name', p.name, 'quantity', ei.quantity) ORDER BY p.name), '[]')
   FROM event_items ei JOIN products p ON p.id = ei.product_id
   WHERE ei.event_id = d.event_id AND p.seller_id = d.seller_id)`;

// $1 = rider de la sessió (per saber si el seu vehicle hi arriba i si té un altre servei a la mateixa hora).
export const SERVICE = `
  SELECT d.id, d.event_id, d.delivery_type, d.status, d.rider_id, d.assigned_at,
         lower(d.time_window) AS starts_at, upper(d.time_window) AS ends_at,
         v.code AS vehicle_type, v.name AS vehicle_name,
         a.postal_code, a.city, a.street, a.access_instructions,
         u.full_name AS customer_name,
         s.id AS seller_id, s.legal_name AS seller_legal_name, s.city AS seller_city,
         e.booking_number, e.status AS booking_status,
         ${ITEMS} AS items
  FROM deliveries d
  JOIN events e        ON e.id = d.event_id
  JOIN addresses a     ON a.id = e.address_id
  JOIN users u         ON u.id = e.customer_id
  JOIN sellers s       ON s.id = d.seller_id
  JOIN vehicle_types v ON v.code = d.vehicle_type`;

/** Servei amb la forma del contracte JSON. `personal`: si s'hi inclouen les dades del client. */
export function toService(row, { personal }) {
  const service = {
    id: row.id,
    type: row.delivery_type,
    status: row.status,
    timeWindow: { startsAt: row.starts_at, endsAt: row.ends_at },
    zone: { postalCode: row.postal_code, city: row.city },
    vehicle: { type: row.vehicle_type, name: row.vehicle_name },
    seller: { id: row.seller_id, legalName: row.seller_legal_name, city: row.seller_city },
    items: row.items.map(({ name, quantity }) => ({ name, quantity })),
  };
  if (personal) {
    // El rider del servei necessita l'id de cada línia per fer-ne les fotos i el checklist (US-11).
    service.items = row.items.map(({ eventItemId, name, quantity }) => ({ eventItemId, name, quantity }));
    service.bookingNumber = row.booking_number;
    service.assignedAt = row.assigned_at;
    service.address = {
      street: row.street,
      postalCode: row.postal_code,
      city: row.city,
      accessInstructions: row.access_instructions,
    };
    service.customer = { fullName: row.customer_name };
  }
  return service;
}

// Serveis del rider $1, amb `changed_at` per saber si s'han modificat després d'acceptar-los.
export const MY_SERVICES = `
  SELECT d.id, d.event_id, d.delivery_type, d.status, d.rider_id, d.assigned_at, d.changed_at,
         lower(d.time_window) AS starts_at, upper(d.time_window) AS ends_at,
         v.code AS vehicle_type, v.name AS vehicle_name,
         a.postal_code, a.city, a.street, a.access_instructions,
         u.full_name AS customer_name,
         s.id AS seller_id, s.legal_name AS seller_legal_name, s.city AS seller_city,
         e.booking_number, e.status AS booking_status,
         (SELECT coalesce(json_agg(json_build_object('eventItemId', ei.id, 'name', p.name, 'quantity', ei.quantity) ORDER BY p.name), '[]')
          FROM event_items ei JOIN products p ON p.id = ei.product_id
          WHERE ei.event_id = d.event_id AND p.seller_id = d.seller_id) AS items
  FROM deliveries d
  JOIN events e        ON e.id = d.event_id
  JOIN addresses a     ON a.id = e.address_id
  JOIN users u         ON u.id = e.customer_id
  JOIN sellers s       ON s.id = d.seller_id
  JOIN vehicle_types v ON v.code = d.vehicle_type
  WHERE d.rider_id = $1`;

export function toMyService(row) {
  return {
    ...toService(row, { personal: true }),
    // El servei ha canviat (franja, estat o vehicle) després que el rider l'acceptés.
    changedSinceAssigned: row.changed_at > row.assigned_at,
  };
}

export function createRiderRepository(pool) {
  return {
    /** Perfil del rider: { userId, vehicleType } o null si l'usuari no en té. */
    async findRider(userId) {
      const { rows } = await pool.query('SELECT user_id, vehicle_type FROM riders WHERE user_id = $1', [userId]);
      return rows[0] ? { userId: rows[0].user_id, vehicleType: rows[0].vehicle_type } : null;
    },

    /** Un servei del rider, o null si no existeix o és d'un altre rider. */
    async findMine(serviceId, riderId) {
      const { rows } = await pool.query(`${MY_SERVICES} AND d.id = $2`, [riderId, serviceId]);
      return rows[0] ? toMyService(rows[0]) : null;
    },
  };
}
