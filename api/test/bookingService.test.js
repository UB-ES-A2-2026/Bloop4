import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBookingService } from '../src/bookings/service.js';
import { createHooks } from '../src/hooks.js';

describe('bookingService.confirm (US-08)', () => {
  const result = { booking: { id: 'b1', status: 'confirmed' }, sellers: [{ legalName: 'Sonido Levante S.L.' }] };

  it('confirma la reserva pagada i ho fa saber (bookingConfirmed)', async () => {
    const hooks = createHooks();
    const heard = [];
    hooks.on('bookingConfirmed', (r) => heard.push(r));
    const service = createBookingService({ bookingRepository: { async confirm(id) { return id === 'b1' ? result : null; } }, hooks });
    assert.deepEqual(await service.confirm('b1'), result.booking);
    assert.deepEqual(heard, [result]);
  });

  it('si la reserva ja no estava pendent no fa saber res', async () => {
    const hooks = createHooks();
    hooks.on('bookingConfirmed', () => assert.fail('no s\'havia de fer saber'));
    const service = createBookingService({ bookingRepository: { async confirm() { return null; } }, hooks });
    assert.equal(await service.confirm('b1'), null);
  });
});
