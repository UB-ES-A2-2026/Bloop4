// Prova les proves de lliurament (US-11) contra PostgreSQL: fotos, checklist, accés, incidències,
// tancament de la reserva i alliberament de la fiança.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPool } from '../src/db.js';
import { createRiderRepository } from '../src/repositories/riderRepository.js';
import { createProofRepository } from '../src/repositories/proofRepository.js';
import { createIncidentRepository } from '../src/repositories/incidentRepository.js';
import { createNotificationRepository } from '../src/repositories/notificationRepository.js';
import { createIncidentService } from '../src/proofs/incidents.js';
import { createProofStore } from '../src/uploads/proofs.js';
import { assignServices, cleanup, confirmBooking, createCustomers, createReadyCart, createRiders, setServiceStatus } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006'; // Sonido Levante (usuari sonido@example.com)
const SONIDO_USER = 'b0000000-0000-4000-8000-000000000002';
const ADMIN = 'b0000000-0000-4000-8000-000000000005';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';

describe('proves de lliurament (PostgreSQL)', { skip }, () => {
  const pool = skip ? null : createPool();
  const riders = skip ? null : createRiderRepository(pool);
  const proofs = skip ? null : createProofRepository(pool);
  const incidents = skip ? null : createIncidentRepository(pool);
  const notifications = skip ? null : createNotificationRepository(pool);
  const released = [];
  const service = skip ? null : createIncidentService({
    incidentRepository: incidents, notificationRepository: notifications, releaseDeposit: async (id) => released.push(id), logger: { error() {} },
  });
  let dir;
  let store;

  /**
   * Reserva confirmada amb el lliurament i la recollida assignats al mateix rider (com si els
   * hagués acceptat). Per iniciar un servei es posa 'in_transit' directament (`start`).
   */
  async function booking(day) {
    const [customer] = await createCustomers(pool, 1, 'proof');
    const eventId = await createReadyCart(pool, customer, { productId: FOCO, quantity: 2, day });
    await confirmBooking(pool, eventId);
    const [riderId] = await createRiders(pool, 1, 'van');
    const ids = await assignServices(pool, eventId, riderId);
    const item = (await pool.query('SELECT id FROM event_items WHERE event_id = $1', [eventId])).rows[0].id;
    return { eventId, customer, riderId, ...ids, item };
  }
  async function photo(serviceId, eventItemId) {
    const stored = await store.save(serviceId, JPEG, 'jpg');
    return proofs.addPhoto({ deliveryId: serviceId, eventItemId, ...stored });
  }
  /** Inicia el servei, en fa una foto i el completa amb l'estat indicat. */
  async function finish(b, type, condition = 'correct', note = null) {
    await start(b[type]);
    await photo(b[type], b.item);
    const result = await proofs.complete(b[type], b.riderId, [{ eventItemId: b.item, condition, note }]);
    await service.afterCompletion(result);
    return result;
  }
  const start = (serviceId) => setServiceStatus(pool, serviceId, 'in_transit');
  const eventStatus = async (id) => (await pool.query('SELECT status FROM events WHERE id = $1', [id])).rows[0].status;

  before(async () => {
    if (!pool) return;
    dir = await mkdtemp(path.join(tmpdir(), 'bloop4-proofs-'));
    store = createProofStore(dir);
    await cleanupProofs();
  });
  after(async () => {
    if (!pool) return;
    await cleanupProofs();
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  });
  async function cleanupProofs() {
    const services = "SELECT d.id FROM deliveries d JOIN events e ON e.id = d.event_id JOIN users u ON u.id = e.customer_id WHERE u.email LIKE '%@test.invalid'";
    await pool.query(`DELETE FROM incidents WHERE delivery_id IN (${services})`);
    await pool.query(`DELETE FROM proof_items WHERE delivery_id IN (${services})`);
    await pool.query(`DELETE FROM delivery_proofs WHERE delivery_id IN (${services})`);
    await pool.query(`DELETE FROM proof_photos WHERE delivery_id IN (${services})`);
    await pool.query("DELETE FROM notifications WHERE kind = 'incident' OR user_id IN (SELECT id FROM users WHERE email LIKE '%@test.invalid')");
    await cleanup(pool);
  }

  it('el detall del servei del rider porta l\'id de cada línia, el que fan servir les fotos i el checklist', async () => {
    const b = await booking('2033-04-09');
    const mine = await riders.findMine(b.delivery, b.riderId);
    assert.deepEqual(mine.items.map((i) => i.eventItemId), [b.item]);
  });

  it('sense iniciar el servei no s\'hi poden afegir proves', async () => {
    const b = await booking('2033-04-10');
    await assert.rejects(proofs.requireInTransit(b.delivery, b.riderId), (err) => err.details?.reason === 'NOT_IN_TRANSIT');
    await assert.rejects(proofs.requireInTransit(b.delivery, (await createRiders(pool, 1))[0]), (err) => err.status === 404);
  });

  it('sense una foto de cada línia o sense l\'estat de totes, el servei no es completa', async () => {
    const b = await booking('2033-04-11');
    await start(b.delivery);
    await assert.rejects(proofs.complete(b.delivery, b.riderId, [{ eventItemId: b.item, condition: 'correct' }]), (err) => {
      assert.equal(err.details.field, 'photos');
      assert.equal(err.details.missing[0].name, 'Foco PAR LED RGBW 18x10 W');
      return true;
    });
    await photo(b.delivery, b.item);
    await assert.rejects(proofs.complete(b.delivery, b.riderId, []), (err) => err.details?.field === 'items');
    const status = (await pool.query('SELECT status FROM deliveries WHERE id = $1', [b.delivery])).rows[0].status;
    assert.equal(status, 'in_transit');
  });

  it('el servei completat desa el checklist i les fotos, i qui pot el veu', async () => {
    const b = await booking('2033-04-12');
    await finish(b, 'delivery');
    const proof = await proofs.proof(b.delivery);
    assert.equal(proof.status, 'delivered');
    assert.ok(proof.completedAt);
    assert.deepEqual(proof.items.map((i) => [i.name, i.quantity, i.condition, i.photos.length]), [['Foco PAR LED RGBW 18x10 W', 2, 'correct', 1]]);
    assert.match(proof.items[0].photos[0].url, /^\/api\/proofs\/photos\/[0-9a-f-]{36}$/);

    const as = (id, roles = []) => ({ id, roles });
    assert.equal(await proofs.canView(b.delivery, as(b.riderId, ['rider'])), true);
    assert.equal(await proofs.canView(b.delivery, as(b.customer, ['customer'])), true);
    assert.equal(await proofs.canView(b.delivery, as(SONIDO_USER, ['seller'])), true);
    assert.equal(await proofs.canView(b.delivery, as(ADMIN, ['admin'])), true);
    const [stranger] = await createCustomers(pool, 1, 'stranger');
    assert.equal(await proofs.canView(b.delivery, as(stranger, ['customer'])), false);
    assert.equal(await proofs.canView(b.delivery, as('b0000000-0000-4000-8000-000000000003', ['seller'])), false);

    // La foto es pot llegir del directori privat; un cop completat, ja no es pot esborrar.
    const { path: file } = await proofs.findPhoto(proof.items[0].photos[0].id);
    assert.deepEqual(await store.read(file), JPEG);
    assert.equal(await proofs.deletePhoto(proof.items[0].photos[0].id, b.delivery), null);
  });

  it('una foto d\'una línia d\'un altre venedor es rebutja a la BD', async () => {
    const b = await booking('2033-04-13');
    const other = (await pool.query("SELECT id FROM event_items WHERE event_id = 'f0000000-0000-4000-8000-000000000001' LIMIT 1")).rows[0].id;
    const stored = await store.save(b.delivery, JPEG, 'jpg');
    await assert.rejects(proofs.addPhoto({ deliveryId: b.delivery, eventItemId: other, ...stored }), (err) => err.code === '23514');
  });

  it('una recollida correcta tanca la reserva i allibera la fiança', async () => {
    released.length = 0;
    const b = await booking('2033-04-14');
    await finish(b, 'delivery');
    assert.equal(await eventStatus(b.eventId), 'confirmed');
    await finish(b, 'pickup');
    assert.equal(await eventStatus(b.eventId), 'completed');
    assert.deepEqual(released, [b.eventId]);
  });

  it('amb material danyat a la recollida: incidència, avisos i la fiança no s\'allibera fins que es resol', async () => {
    released.length = 0;
    const b = await booking('2033-04-15');
    await finish(b, 'delivery');
    await finish(b, 'pickup', 'damaged', 'Un foco tiene la lente rota');
    assert.equal(await eventStatus(b.eventId), 'completed');
    assert.deepEqual(released, []);

    const [incident] = (await incidents.list({ status: 'open' })).filter((i) => i.serviceId === b.pickup);
    assert.equal(incident.kind, 'damaged');
    assert.match(incident.description, /lente rota/);
    const sellerNotes = (await notifications.list(SONIDO_USER)).notifications.filter((n) => n.kind === 'incident');
    const adminNotes = (await notifications.list(ADMIN)).notifications.filter((n) => n.kind === 'incident');
    assert.ok(sellerNotes.length >= 1 && adminNotes.length >= 1);
    assert.equal(sellerNotes[0].link, '/vendedor/servicios');

    const result = await service.resolve(incident.id, ADMIN, 'El vendedor descuenta la lente de la fianza');
    assert.deepEqual(result, { completed: true, openIncidents: 0 });
    assert.deepEqual(released, [b.eventId]);
    await assert.rejects(service.resolve(incident.id, ADMIN, 'Otra vez'), (err) => err.status === 409);
  });

  it('si el client no hi és, el servei queda en incidència i no es dona per completat', async () => {
    const b = await booking('2033-04-16');
    await start(b.delivery);
    const incident = await service.report(b.delivery, b.riderId, { kind: 'customer_absent', description: 'Nadie abre la puerta' });
    assert.equal(incident.status, 'open');
    const { rows } = await pool.query('SELECT d.status, p.delivery_id AS proof FROM deliveries d LEFT JOIN delivery_proofs p ON p.delivery_id = d.id WHERE d.id = $1', [b.delivery]);
    assert.deepEqual([rows[0].status, rows[0].proof], ['incident', null]);
    // Ja no es pot completar ni tornar a registrar una incidència.
    await assert.rejects(proofs.complete(b.delivery, b.riderId, [{ eventItemId: b.item, condition: 'correct' }]), (err) => err.status === 409);
    await assert.rejects(service.report(b.delivery, b.riderId, { kind: 'other', description: 'Otra' }), (err) => err.status === 409);
  });

  it('el venedor veu els seus serveis amb si tenen prova i incidències obertes', async () => {
    const b = await booking('2033-04-17');
    await finish(b, 'delivery');
    const list = await proofs.sellerServices('a0000000-0000-4000-8000-000000000001');
    const delivered = list.find((s) => s.id === b.delivery);
    assert.deepEqual([delivered.status, delivered.hasProof, delivered.openIncidents], ['delivered', true, 0]);
  });
});
