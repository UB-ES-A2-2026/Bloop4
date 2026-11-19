import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOwnBooking } from '../src/bookings/access.js';
import { createHooks } from '../src/hooks.js';

const BOOKING = 'f0000000-0000-4000-8000-0000000000aa';

describe('ownBooking (fonaments)', () => {
  const hooks = createHooks();
  const reads = [];
  hooks.on('beforeBookingRead', (customerId) => reads.push(customerId));
  const ownBooking = createOwnBooking({
    bookingRepository: { async findBooking(id) { return id === BOOKING ? { id, customerId: 'u1', status: 'confirmed' } : null; } },
    hooks,
  });
  const req = (id, userId = 'u1') => ({ params: { id }, user: { id: userId } });

  it('retorna la reserva del client després de fer saber que s\'hi accedeix', async () => {
    assert.deepEqual(await ownBooking(req(BOOKING.toUpperCase())), { id: BOOKING, customerId: 'u1', status: 'confirmed' });
    assert.deepEqual(reads, ['u1']);
  });

  it('400 si l\'id no és vàlid, 404 si no existeix, 403 si és d\'un altre client', async () => {
    await assert.rejects(ownBooking(req('123')), (err) => err.status === 400 && err.details.field === 'id');
    await assert.rejects(ownBooking(req('f0000000-0000-4000-8000-0000000000bb')), (err) => err.status === 404);
    await assert.rejects(ownBooking(req(BOOKING, 'u2')), (err) => err.status === 403);
  });
});
