// Estats de les reserves i dels serveis per a les proves E2E del Sprint 2. Es fan amb SQL (com els
// seeds) perquè cada història es pugui provar sola: per exemple, el pagament (US-08) parteix d'una
// reserva pendent sense passar pel checkout (US-12). Cada prova fa servir clients i riders nous i
// dates seves (eventDates), així que no xoca amb les altres ni amb els seeds.
import { createVerifiedCustomer, signIn } from './accounts.mjs';
import { literal, sql } from './db.mjs';

export const PRODUCTS = {
  altavoz: { id: 'd0000000-0000-4000-8000-000000000001', name: 'Altavoz activo 12" 1300 W', seller: 'a0000000-0000-4000-8000-000000000001' },
  micro: { id: 'd0000000-0000-4000-8000-000000000004', name: 'Micrófono inalámbrico de mano', seller: 'a0000000-0000-4000-8000-000000000001' },
  silla: { id: 'd0000000-0000-4000-8000-000000000009', name: 'Silla Tiffany blanca', seller: 'a0000000-0000-4000-8000-000000000002' },
};

/** Id de l'usuari amb aquest correu. */
export function userId(email) {
  return sql(`SELECT id FROM users WHERE email = ${literal(email)}`)[0][0];
}

/** Rider nou i verificat amb el vehicle indicat, amb la sessió iniciada a `page`. */
export async function createRider(request, page, { vehicle = 'van' } = {}) {
  const rider = await createVerifiedCustomer(request);
  rider.id = userId(rider.email);
  sql(`UPDATE user_roles SET role = 'rider' WHERE user_id = '${rider.id}';
       INSERT INTO riders (user_id, vehicle_type) VALUES ('${rider.id}', ${literal(vehicle)});`);
  if (page) await signIn(page, rider);
  return rider;
}

/**
 * Reserva del client `customerId` per al dia `day` ('AAAA-MM-DD'): l'esdeveniment de 18:00 a 02:00
 * (Madrid), el lliurament de cada venedor a les 08:00 del mateix dia i la recollida a les 10:00 de
 * l'endemà, a València. `status`: 'pending_payment' (bloqueig de 15 min), 'confirmed' o 'completed'.
 * `rider`: si hi és, els serveis li queden assignats; el lliurament, amb `serviceStatus` ('in_transit'…).
 * `postalCode`: per trobar els serveis de la prova a la llista de serveis disponibles.
 * @returns { eventId, bookingNumber, services: { delivery, pickup } } (serveis del primer venedor)
 */
export function createBooking({ customerId, day, status = 'confirmed', items = [{ product: PRODUCTS.altavoz, quantity: 1 }], rider, serviceStatus = 'assigned', postalCode = '46001' }) {
  const [[eventId]] = sql(`
    WITH a AS (
      INSERT INTO addresses (user_id, street, postal_code, city, access_instructions)
      VALUES ('${customerId}', 'Calle de Proves 1', ${literal(postalCode)}, 'Valencia', 'Timbre 2')
      RETURNING id
    )
    INSERT INTO events (customer_id, status, starts_at, ends_at, address_id)
    SELECT '${customerId}', 'draft', (DATE '${day}' + time '18:00') AT TIME ZONE 'Europe/Madrid',
           (DATE '${day}' + 1 + time '02:00') AT TIME ZONE 'Europe/Madrid', a.id
    FROM a
    RETURNING id;`);
  for (const { product, quantity } of items) {
    sql(`INSERT INTO event_items (event_id, product_id, quantity) VALUES ('${eventId}', '${product.id}', ${Number(quantity)});`);
  }
  const sellers = [...new Set(items.map((i) => i.product.seller))];
  for (const seller of sellers) {
    sql(`
      INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type) VALUES
        ('${eventId}', '${seller}', 'delivery', tstzrange((DATE '${day}' + time '08:00') AT TIME ZONE 'Europe/Madrid', (DATE '${day}' + time '10:00') AT TIME ZONE 'Europe/Madrid', '[)'), 'van'),
        ('${eventId}', '${seller}', 'pickup', tstzrange((DATE '${day}' + 1 + time '10:00') AT TIME ZONE 'Europe/Madrid', (DATE '${day}' + 1 + time '12:00') AT TIME ZONE 'Europe/Madrid', '[)'), 'van');
      INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) VALUES ('${eventId}', '${seller}', 'van', 45.00, 'EUR');`);
  }
  const holds = status === 'pending_payment' ? ", hold_expires_at = now() + interval '15 minutes'" : '';
  const confirmed = status === 'pending_payment' ? '' : ', confirmed_at = now()';
  sql(`UPDATE events SET status = ${literal(status)}${holds}${confirmed} WHERE id = '${eventId}';`);
  if (rider) {
    sql(`UPDATE deliveries SET status = 'assigned', rider_id = '${rider.id}', assigned_at = now() WHERE event_id = '${eventId}';`);
    if (serviceStatus !== 'assigned') sql(`UPDATE deliveries SET status = ${literal(serviceStatus)} WHERE event_id = '${eventId}' AND delivery_type = 'delivery';`);
  }
  const rows = sql(`SELECT d.delivery_type, d.id FROM deliveries d WHERE d.event_id = '${eventId}' AND d.seller_id = '${sellers[0]}'`);
  return {
    eventId,
    bookingNumber: sql(`SELECT booking_number FROM events WHERE id = '${eventId}'`)[0][0],
    services: Object.fromEntries(rows),
  };
}

/** Codi postal de 5 xifres que no fa servir cap altra prova (per identificar-ne els serveis). */
export function uniquePostalCode(index) {
  return String(10000 + ((Date.now() / 1000 + index * 7919) % 89999 | 0)).padStart(5, '0');
}
