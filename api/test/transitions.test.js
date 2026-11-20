import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, phaseOf } from '../src/tracking/transitions.js';

describe('transicions dels serveis', () => {
  it('segueixen l\'ordre pendent → assignat → en curs → lliurat (o incidència)', () => {
    for (const [from, to] of [['pending', 'assigned'], ['assigned', 'in_transit'], ['in_transit', 'delivered'], ['in_transit', 'incident'], ['assigned', 'cancelled']]) {
      assert.equal(canTransition(from, to), true, `${from} → ${to}`);
    }
  });

  it('no es pot saltar cap fase ni tornar enrere', () => {
    for (const [from, to] of [['assigned', 'delivered'], ['pending', 'in_transit'], ['delivered', 'in_transit'], ['cancelled', 'assigned'], ['incident', 'delivered'], ['in_transit', 'assigned'], ['x', 'assigned']]) {
      assert.equal(canTransition(from, to), false, `${from} → ${to}`);
    }
  });
});

describe('fase que veu el client', () => {
  const s = (status) => ({ status });
  it('va de confirmada a recollida segons el lliurament i la recollida', () => {
    assert.equal(phaseOf({ delivery: s('assigned'), pickup: s('pending') }), 'confirmed');
    assert.equal(phaseOf({ delivery: s('in_transit'), pickup: s('assigned') }), 'delivery_in_transit');
    assert.equal(phaseOf({ delivery: s('delivered'), pickup: s('assigned') }), 'delivered');
    assert.equal(phaseOf({ delivery: s('delivered'), pickup: s('in_transit') }), 'pickup_in_transit');
    assert.equal(phaseOf({ delivery: s('delivered'), pickup: s('delivered') }), 'picked_up');
  });

  it('una incidència es diferencia d\'un servei completat; tot cancel·lat és cancel·lat', () => {
    assert.equal(phaseOf({ delivery: s('incident'), pickup: s('assigned') }), 'incident');
    assert.equal(phaseOf({ delivery: s('delivered'), pickup: s('incident') }), 'incident');
    assert.equal(phaseOf({ delivery: s('cancelled'), pickup: s('cancelled') }), 'cancelled');
  });
});
