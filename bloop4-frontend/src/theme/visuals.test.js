import { describe, expect, it } from 'vitest';
import { getGlyph, getProductVisuals } from './visuals';
import { makeProduct } from '../test/fixtures';

describe('getGlyph', () => {
  it.each([
    ['Altavoz activo 12" 1300 W', '12"'],
    ['Foco LED 1500 W', '1500W'],
    ['Carpa plegable 3x3 m', '3×3m'],
    ['Mesa rectangular 180 cm', '180cm'],
  ])('%s → %s', (name, glyph) => {
    expect(getGlyph(makeProduct({ name }))).toBe(glyph);
  });

  it('treu la unitat si la mida amb unitat no hi cap', () => {
    expect(getGlyph(makeProduct({ name: 'Tarima 18x10 m' }))).toBe('18×10');
  });

  it('fa servir la categoria abreujada si no hi ha mida o és massa llarga', () => {
    const category = { id: 'c1', name: 'Sillas', slug: 'sillas' };
    expect(getGlyph(makeProduct({ name: 'Silla plegable blanca', category }))).toBe('SIL');
    expect(getGlyph(makeProduct({ name: 'Escenario 1200x800 cm', category }))).toBe('SIL');
  });
});

describe('getProductVisuals', () => {
  it('pren el color de la categoria arrel, no de la subcategoria', () => {
    const { background } = getProductVisuals(makeProduct());
    expect(background).toBe('oklch(0.79 0.14 238)'); // sonido → sky
  });

  it('fa servir la pròpia categoria si ja és arrel', () => {
    const product = makeProduct({
      category: { id: 'c5', name: 'Iluminación', slug: 'iluminacion' },
      parentCategory: null,
    });
    expect(getProductVisuals(product).background).toBe('oklch(0.79 0.14 92)'); // sun
  });

  it('una categoria arrel desconeguda agafa el color per defecte', () => {
    const product = makeProduct({ parentCategory: { id: 'cx', name: 'Catering', slug: 'catering' } });
    expect(getProductVisuals(product).background).toBe('oklch(0.79 0.14 292)'); // violet
  });

  it('la forma depèn només de l\'id', () => {
    const a = getProductVisuals(makeProduct({ name: 'A' }));
    const b = getProductVisuals(makeProduct({ name: 'B' }));
    expect(a.shape).toBe(b.shape);
  });
});
