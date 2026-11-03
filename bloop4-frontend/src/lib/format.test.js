import { describe, expect, it } from 'vitest';
import { formatPrice } from './format';

describe('formatPrice', () => {
  it('sense decimals si l\'import és enter i amb 2 si té cèntims', () => {
    expect(formatPrice('45.00', 'EUR')).toMatch(/^45\s€$/);
    expect(formatPrice('3.50', 'EUR')).toMatch(/^3,50\s€$/);
    expect(formatPrice('1200.00', 'EUR')).toMatch(/^1200\s€$|^1\.200\s€$/);
  });
});
