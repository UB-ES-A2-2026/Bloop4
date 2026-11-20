// Prova el pagament (US-08) de punta a punta contra PostgreSQL amb la passarel·la simulada:
// reserva pendent → pagament → webhook signat → reserva confirmada, comprovant i fiança. La reserva
// pendent es prepara amb SQL (test-support), com la deixaria el checkout de US-12.
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db.js';
import { createBookingRepository } from '../src/repositories/bookingRepository.js';
import { createPaymentRepository } from '../src/repositories/paymentRepository.js';
import { createBookingService } from '../src/bookings/service.js';
import { createPaymentService } from '../src/payments/service.js';
import { createMockGateway, MOCK_CARDS } from '../src/payments/mockGateway.js';
import { WebhookSignatureError } from '../src/payments/gateway.js';
import { createHooks } from '../src/hooks.js';
import { cleanup, createCustomers, createReadyCart, holdBooking, returnToCart } from '../test-support/bookingFixtures.js';

const FOCO = 'd0000000-0000-4000-8000-000000000006'; // 8 €/dia, fiança 30 €
const SILLA = 'd0000000-0000-4000-8000-000000000009'; // sense fiança
const skip = !process.env.DATABASE_URL && 'sense DATABASE_URL';
/** 'AAAA-MM-DD' d'aquí a `days` dies. */
const dayFromNow = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('pagament d\'una reserva (PostgreSQL + passarel·la simulada)', { skip }, () => {
  const pool = skip ? null : createPool();
  const mails = [];
  const mailer = new Proxy({}, { get: (target, name) => async (mail) => { mails.push([name, mail]); } });
  const gateway = createMockGateway({ appUrl: 'http://app.test', secret: 'secret-de-prova' });
  const bookings = skip ? null : createBookingRepository(pool);
  const payments = skip ? null : createPaymentRepository(pool);
  // Reserves confirmades que es fan saber (US-12 hi avisa els venedors).
  const confirmed = [];
  const hooks = createHooks();
  hooks.on('bookingConfirmed', (result) => confirmed.push(result));
  const service = skip ? null : createPaymentService({
    gateway, paymentRepository: payments, mailer, config: { appUrl: 'http://app.test' }, logger: { error() {} },
    bookingService: createBookingService({ bookingRepository: bookings, hooks }),
  });
  const USER = { email: 'cliente-prueba@test.invalid' };

  /** Reserva pendent de pagament d'un client nou. */
  // Cada reserva en un dia diferent: així no s'omple la capacitat de les franges del venedor.
  let dayOffset = 0;
  const nextDay = () => new Date(Date.UTC(2032, 2, 10 + dayOffset++)).toISOString().slice(0, 10);
  async function pendingBooking({ productId = FOCO, quantity = 2, day = nextDay() } = {}) {
    const [customer] = await createCustomers(pool, 1, 'pay');
    const eventId = await createReadyCart(pool, customer, { productId, quantity, day });
    await holdBooking(pool, eventId);
    return bookings.findBooking(eventId);
  }
  const pay = (payment, cardNumber = MOCK_CARDS.ok) => {
    const event = gateway.buildEvent({ ref: payment.ref, cardNumber });
    return service.handleWebhook(event.body, event.headers);
  };

  before(async () => { if (pool) await cleanupPayments(); });
  beforeEach(() => { mails.length = 0; confirmed.length = 0; });
  after(async () => {
    if (!pool) return;
    await cleanupPayments();
    await pool.end();
  });
  async function cleanupPayments() {
    const events = "SELECT e.id FROM events e JOIN users u ON u.id = e.customer_id WHERE u.email LIKE '%@test.invalid'";
    await pool.query(`DELETE FROM deposit_holds WHERE event_id IN (${events})`);
    await pool.query(`DELETE FROM payments WHERE event_id IN (${events})`);
    await pool.query("DELETE FROM payment_webhook_events WHERE provider = 'mock'");
    await cleanup(pool);
  }

  it('l\'import es calcula al servidor (lloguer + transport) i una reserva només té un pagament en curs', async () => {
    const booking = await pendingBooking(); // 2 focos × 8 € × 1 dia + 45 € de transport
    const payment = await service.start(booking, USER);
    assert.deepEqual([payment.amount, payment.amountMinor, payment.currency, payment.status], ['61.00', 6100, 'EUR', 'pending']);
    assert.match(payment.checkoutUrl, /^http:\/\/app\.test\/pago-simulado\?ref=mock_cs_/);

    const [again, concurrent] = await Promise.all([service.start(booking, USER), service.start(booking, USER)]);
    assert.equal(again.id, payment.id);
    assert.equal(concurrent.id, payment.id);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM payments WHERE event_id = $1', [booking.id])).rows[0].n, 1);
  });

  it('el pagament correcte confirma la reserva, genera el comprovant, avisa el client i fa saber la confirmació', async () => {
    const booking = await pendingBooking();
    const payment = await service.start(booking, USER);
    assert.equal((await service.status(booking.id)).status, 'pending');

    assert.equal(await pay(payment), 'processed');
    assert.equal((await bookings.findBooking(booking.id)).status, 'confirmed');
    const status = await service.status(booking.id);
    assert.equal(status.status, 'succeeded');
    assert.match(status.receiptNumber, /^R-\d{4}-\d{6}$/);
    assert.equal(status.checkoutUrl, null);
    assert.deepEqual(mails.map(([name]) => name), ['sendReceiptEmail']);
    assert.deepEqual(confirmed.map((c) => [c.booking.id, c.sellers.map((s) => s.legalName)]), [[booking.id, ['Sonido Levante S.L.']]]);
    const receipt = mails.find(([name]) => name === 'sendReceiptEmail')[1];
    assert.deepEqual([receipt.amount, receipt.bookingNumber, receipt.receiptNumber], ['61.00', booking.bookingNumber, status.receiptNumber]);
  });

  it('un avís repetit no es processa dues vegades i un de signatura falsa es rebutja', async () => {
    const booking = await pendingBooking();
    const payment = await service.start(booking, USER);
    const event = gateway.buildEvent({ ref: payment.ref, cardNumber: MOCK_CARDS.ok });
    assert.equal(await service.handleWebhook(event.body, event.headers), 'processed');
    assert.equal(await service.handleWebhook(event.body, event.headers), 'ignored');
    assert.equal(mails.filter(([name]) => name === 'sendReceiptEmail').length, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM payments WHERE event_id = $1 AND status = 'succeeded'", [booking.id])).rows[0].n, 1);

    const forged = createMockGateway({ secret: 'atacant' }).buildEvent({ ref: payment.ref, cardNumber: MOCK_CARDS.ok });
    await assert.rejects(service.handleWebhook(forged.body, forged.headers), WebhookSignatureError);
    const unknown = gateway.buildEvent({ ref: 'mock_cs_inexistent', cardNumber: MOCK_CARDS.ok });
    assert.equal(await service.handleWebhook(unknown.body, unknown.headers), 'ignored');
  });

  it('una targeta rebutjada no confirma la reserva i es pot tornar a intentar amb un pagament nou', async () => {
    const booking = await pendingBooking();
    const first = await service.start(booking, USER);
    await pay(first, MOCK_CARDS.declined);
    assert.equal((await bookings.findBooking(booking.id)).status, 'pending_payment');
    const status = await service.status(booking.id);
    assert.deepEqual([status.status, status.failureReason], ['failed', 'La tarjeta ha sido rechazada']);
    assert.deepEqual(mails, []);

    const second = await service.start(booking, USER);
    assert.notEqual(second.id, first.id);
    await pay(second);
    assert.equal((await bookings.findBooking(booking.id)).status, 'confirmed');
  });

  it('no es pot pagar una reserva amb el bloqueig caducat ni una que ja no està pendent', async () => {
    const booking = await pendingBooking();
    await assert.rejects(service.start({ ...booking, holdExpiresAt: new Date(Date.now() - 1000) }, USER), (err) => err.status === 409 && err.details.reason === 'HOLD_EXPIRED');
    await assert.rejects(service.start({ ...booking, status: 'confirmed' }, USER), (err) => err.details.reason === 'NOT_PENDING');
    assert.deepEqual(await service.status(booking.id), { status: 'none', deposit: null });
  });

  it('si el pagament arriba amb el bloqueig caducat, es retorna l\'import i la reserva no es confirma', async () => {
    const booking = await pendingBooking();
    const payment = await service.start(booking, USER);
    // El bloqueig caduca i la reserva torna a ser la cistella (US-12).
    await returnToCart(pool, booking.id);

    assert.equal(await pay(payment), 'processed');
    assert.equal((await service.status(booking.id)).status, 'refunded');
    assert.equal((await pool.query('SELECT status FROM events WHERE id = $1', [booking.id])).rows[0].status, 'draft');
    assert.deepEqual(mails.map(([name]) => name), ['sendPaymentRefundedEmail']);
  });

  it('la tasca periòdica tanca els pagaments en curs de reserves que ja no estan pendents', async () => {
    const booking = await pendingBooking();
    await service.start(booking, USER);
    assert.equal(await service.closeStalePayments(), 0);
    await returnToCart(pool, booking.id);
    assert.equal(await service.closeStalePayments(), 1);
    assert.equal((await service.status(booking.id)).status, 'cancelled');
  });

  describe('fiança', () => {
    it('amb el lliurament llunyà queda programada per a 7 dies abans i es reté quan toca', async () => {
      const booking = await pendingBooking({ day: '2032-08-10' }); // 2 focos × 30 € de fiança
      await pay(await service.start(booking, USER));
      let { deposit } = await service.status(booking.id);
      assert.deepEqual([deposit.status, deposit.amount], ['scheduled', '60.00']);
      // Lliurament el 10/08/2032 a les 08:00 de Madrid → retenció el 03/08 a la mateixa hora.
      assert.equal(new Date(deposit.scheduledFor).toISOString(), '2032-08-03T06:00:00.000Z');
      assert.equal(await service.processDueDeposits(), 0);

      await pool.query("UPDATE deposit_holds SET scheduled_for = now() - interval '1 minute' WHERE event_id = $1", [booking.id]);
      assert.equal(await service.processDueDeposits(), 1);
      ({ deposit } = await service.status(booking.id));
      assert.equal(deposit.status, 'held');
      assert.ok(deposit.heldAt);
    });

    it('amb el lliurament d\'aquí a menys de 7 dies es reté en el moment de pagar', async () => {
      const booking = await pendingBooking({ day: dayFromNow(3) });
      await pay(await service.start(booking, USER));
      assert.equal((await service.status(booking.id)).deposit.status, 'held');
    });

    it('si la targeta rebutja la retenció queda com a fallida i s\'avisa el client; el pagament continua sent vàlid', async () => {
      const booking = await pendingBooking({ day: dayFromNow(5) });
      await pay(await service.start(booking, USER), MOCK_CARDS.depositDeclined);
      const status = await service.status(booking.id);
      assert.deepEqual([status.status, status.deposit.status], ['succeeded', 'failed']);
      assert.equal((await bookings.findBooking(booking.id)).status, 'confirmed');
      assert.ok(mails.some(([name, mail]) => name === 'sendDepositFailedEmail' && mail.amount === '60.00'));
    });

    it('un producte sense fiança no crea cap retenció', async () => {
      const booking = await pendingBooking({ productId: SILLA, quantity: 10 });
      await pay(await service.start(booking, USER));
      assert.equal((await service.status(booking.id)).deposit, null);
    });

    it('s\'allibera una sola vegada, tant si estava retinguda com programada', async () => {
      const held = await pendingBooking({ day: dayFromNow(4) });
      await pay(await service.start(held, USER));
      assert.equal(await service.releaseDeposit(held.id), true);
      assert.equal(await service.releaseDeposit(held.id), false);
      assert.equal((await service.status(held.id)).deposit.status, 'released');

      const scheduled = await pendingBooking({ day: '2032-05-10' });
      await pay(await service.start(scheduled, USER));
      assert.equal(await service.releaseDeposit(scheduled.id), true);
      assert.equal(await service.processDueDeposits(), 0);
    });
  });
});
