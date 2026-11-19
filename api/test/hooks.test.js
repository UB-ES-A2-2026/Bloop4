import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHooks } from '../src/hooks.js';

describe('hooks (punts d\'extensió del Sprint 2)', () => {
  it('sense ningú que escolti, fer saber un fet no fa res', async () => {
    const hooks = createHooks();
    assert.equal(hooks.has('bookingConfirmed'), false);
    await hooks.emit('bookingConfirmed', { booking: {} });
  });

  it('crida els gestors en l\'ordre en què s\'han afegit, amb els arguments del fet', async () => {
    const hooks = createHooks();
    const calls = [];
    hooks.on('serviceStatusChanged', async (id) => { await new Promise((r) => setTimeout(r, 5)); calls.push(['a', id]); });
    hooks.on('serviceStatusChanged', (id) => calls.push(['b', id]));
    hooks.on('altre', () => calls.push(['c']));
    await hooks.emit('serviceStatusChanged', 's1');
    assert.deepEqual(calls, [['a', 's1'], ['b', 's1']]);
    assert.equal(hooks.has('serviceStatusChanged'), true);
  });

  it('un error d\'un gestor arriba a qui ha fet saber el fet', async () => {
    const hooks = createHooks();
    hooks.on('beforeBookingRead', () => { throw new Error('BD caiguda'); });
    await assert.rejects(hooks.emit('beforeBookingRead', 'u1'), /BD caiguda/);
  });

  it('un gestor ha de ser una funció', () => {
    assert.throws(() => createHooks().on('bookingSettled', 'no'), TypeError);
  });
});
