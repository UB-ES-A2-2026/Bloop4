/**
 * Dades per als tests d'integració del Sprint 2 (fonaments): clients i riders de prova (correus
 * @test.invalid), una cistella llesta per confirmar i els estats per on passa una reserva i els seus
 * serveis. Els estats es posen amb SQL, sense passar pel codi de cap història: així els tests d'una
 * història no depenen de cap altra. Tot el que es crea aquí s'esborra amb `cleanup`.
 */
const SCRYPT_PLACEHOLDER = 'scrypt$nomes-per-a-tests';

/** Crea `count` clients actius i en retorna els ids. */
export async function createCustomers(pool, count, tag = 'c') {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
     SELECT format('%s-%s-%s@test.invalid', $2::text, n, substr(gen_random_uuid()::text, 1, 8)), $3, 'Cliente de prueba ' || n, 'active', now()
     FROM generate_series(1, $1::int) AS n
     RETURNING id`,
    [count, tag, SCRYPT_PLACEHOLDER],
  );
  const ids = rows.map((r) => r.id);
  await pool.query("INSERT INTO user_roles (user_id, role) SELECT unnest($1::uuid[]), 'customer'", [ids]);
  return ids;
}

/**
 * Cistella del client amb `quantity` unitats de `productId` per al dia `day` ('AAAA-MM-DD', de
 * 12:00 a 22:00 a Madrid), amb l'adreça a València i les franges de lliurament (08:00 del mateix
 * dia) i de recollida (10:00 de l'endemà). @returns l'id de l'esdeveniment
 */
export async function createReadyCart(pool, customerId, { productId, quantity = 1, day }) {
  const event = await pool.query(
    `INSERT INTO events (customer_id, status, starts_at, ends_at)
     VALUES ($1, 'draft', ($2::date + time '12:00') AT TIME ZONE 'Europe/Madrid', ($2::date + time '22:00') AT TIME ZONE 'Europe/Madrid')
     RETURNING id`,
    [customerId, day],
  );
  const eventId = event.rows[0].id;
  await pool.query('INSERT INTO event_items (event_id, product_id, quantity) VALUES ($1, $2, $3)', [eventId, productId, quantity]);
  const address = await pool.query(
    "INSERT INTO addresses (user_id, street, postal_code, city) VALUES ($1, 'Calle de Prueba 1', '46001', 'Valencia') RETURNING id",
    [customerId],
  );
  await pool.query('UPDATE events SET address_id = $2 WHERE id = $1', [eventId, address.rows[0].id]);
  await pool.query(
    `INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type)
     SELECT $1, p.seller_id, w.type, w.time_window, 'van'
     FROM products p,
          (VALUES ('delivery', tstzrange(($3::date + time '08:00') AT TIME ZONE 'Europe/Madrid', ($3::date + time '10:00') AT TIME ZONE 'Europe/Madrid', '[)')),
                  ('pickup',   tstzrange(($3::date + 1 + time '10:00') AT TIME ZONE 'Europe/Madrid', ($3::date + 1 + time '12:00') AT TIME ZONE 'Europe/Madrid', '[)'))
          ) AS w (type, time_window)
     WHERE p.id = $2`,
    [eventId, productId, day],
  );
  await pool.query(
    "INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) SELECT $1, seller_id, 'van', 45.00, 'EUR' FROM products WHERE id = $2",
    [eventId, productId],
  );
  return eventId;
}

/**
 * Reserva pendent de pagament, com la deixa el checkout de US-12: la cistella passa a
 * 'pending_payment' amb el bloqueig de `minutes` minuts.
 */
export async function holdBooking(pool, eventId, minutes = 15) {
  await pool.query(
    "UPDATE events SET status = 'pending_payment', hold_expires_at = now() + make_interval(mins => $2), updated_at = now() WHERE id = $1",
    [eventId, minutes],
  );
}

/** La reserva torna a ser la cistella, com quan el bloqueig caduca o el client el cancel·la (US-12). */
export async function returnToCart(pool, eventId) {
  await pool.query("UPDATE events SET status = 'draft', hold_expires_at = NULL, updated_at = now() WHERE id = $1", [eventId]);
}

/** Reserva confirmada, com la deixa el pagament de US-08. */
export async function confirmBooking(pool, eventId) {
  await pool.query(
    "UPDATE events SET status = 'confirmed', confirmed_at = now(), hold_expires_at = NULL, updated_at = now() WHERE id = $1",
    [eventId],
  );
}

/**
 * Assigna al rider els serveis de la reserva (els `types` indicats), com quan els accepta (US-14).
 * @returns { delivery, pickup } amb l'id de cada servei assignat (del primer venedor si n'hi ha diversos)
 */
export async function assignServices(pool, eventId, riderId, { types = ['delivery', 'pickup'] } = {}) {
  const { rows } = await pool.query(
    `UPDATE deliveries SET status = 'assigned', rider_id = $2, assigned_at = now()
     WHERE event_id = $1 AND delivery_type = ANY($3::text[])
     RETURNING id, delivery_type`,
    [eventId, riderId, types],
  );
  const ids = {};
  for (const row of rows) ids[row.delivery_type] ??= row.id;
  return ids;
}

/** Assigna un servei concret al rider, com quan l'accepta (US-14). */
export async function assignService(pool, serviceId, riderId) {
  await pool.query("UPDATE deliveries SET status = 'assigned', rider_id = $2, assigned_at = now() WHERE id = $1", [serviceId, riderId]);
}

/** Canvia l'estat d'un servei, com quan el rider l'inicia (US-09: 'in_transit') o el completa. */
export async function setServiceStatus(pool, serviceId, status) {
  await pool.query('UPDATE deliveries SET status = $2 WHERE id = $1', [serviceId, status]);
}

/** Crea `count` riders actius amb el vehicle indicat i en retorna els ids. */
export async function createRiders(pool, count, vehicleType = 'van') {
  const ids = await createCustomers(pool, count, `rider-${vehicleType}`);
  await pool.query("UPDATE user_roles SET role = 'rider' WHERE user_id = ANY($1::uuid[])", [ids]);
  await pool.query('INSERT INTO riders (user_id, vehicle_type) SELECT unnest($1::uuid[]), $2', [ids, vehicleType]);
  return ids;
}

/** Esborra tot el que pengi dels clients de prova. */
export async function cleanup(pool) {
  const users = "SELECT id FROM users WHERE email LIKE '%@test.invalid'";
  const events = `SELECT id FROM events WHERE customer_id IN (${users})`;
  await pool.query(`DELETE FROM event_item_units WHERE event_item_id IN (SELECT id FROM event_items WHERE event_id IN (${events}))`);
  for (const table of ['event_items', 'deliveries', 'event_transport']) {
    await pool.query(`DELETE FROM ${table} WHERE event_id IN (${events})`);
  }
  await pool.query(`DELETE FROM events WHERE customer_id IN (${users})`);
  for (const table of ['addresses', 'riders', 'user_roles']) {
    await pool.query(`DELETE FROM ${table} WHERE user_id IN (${users})`);
  }
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.invalid'");
}
