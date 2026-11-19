import { describe, expect, it } from 'vitest';
import { formatCountdown, newIdempotencyKey } from './bookings';

describe('formatCountdown', () => {
  it('mostra minuts i segons amb dos dígits i mai baixa de zero', () => {
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });
});

describe('newIdempotencyKey', () => {
  it('genera claus diferents i vàlides per a la capçalera Idempotency-Key', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});
