/**
 * Decoració de les targetes presa del disseny final (Bloop4.html): color per
 * família de producte, forma de fons i "glif" gran. És només presentació,
 * per això no viu a la base de dades i es deriva de les dades que arriben.
 */

const HUES = { coral: 25, tangerine: 58, sun: 92, lime: 132, mint: 170, sky: 238, violet: 292, pink: 350 };

// Color per categoria de nivell 1 (slug). Una categoria nova agafa el color per defecte.
const ROOT_CATEGORY_HUE = {
  sonido: 'sky',
  iluminacion: 'sun',
  mobiliario: 'tangerine',
  'carpas-y-estructuras': 'mint',
};
const DEFAULT_HUE = 'violet';

const SHAPES = [
  { width: '70%', top: '-28%', left: '48%', borderRadius: '50%', rotate: '0deg' },
  { width: '52%', top: '30%', left: '56%', borderRadius: '20%', rotate: '18deg' },
  { width: '95%', top: '52%', left: '30%', borderRadius: '50%', rotate: '0deg' },
  { width: '46%', top: '8%', left: '58%', borderRadius: '50% 50% 8% 50%', rotate: '-14deg' },
];

const MAX_GLYPH_LENGTH = 5;
// Primera mida del nom: 12", 1500 W, 180 cm, 3x3 m, 18x10...
const MEASURE = /(\d+(?:[.,]\d+)?(?:\s?[x×]\s?\d+(?:[.,]\d+)?)?)\s?(cm|m|W|")?/;

/** Glif de la targeta: la mida del producte si és curta; si no, la categoria abreujada. */
export function getGlyph(product) {
  const match = product.name.match(MEASURE);
  if (match) {
    const value = match[1].replace(/\s/g, '').replace('x', '×');
    const withUnit = value + (match[2] ?? '');
    if (withUnit.length <= MAX_GLYPH_LENGTH) return withUnit;
    if (value.length <= MAX_GLYPH_LENGTH) return value;
  }
  return product.category.name.slice(0, 3).toUpperCase();
}

// Hash estable de l'id → la mateixa targeta té sempre la mateixa forma.
function shapeFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SHAPES[hash % SHAPES.length];
}

export function getProductVisuals(product) {
  const rootSlug = (product.parentCategory ?? product.category).slug;
  const hue = HUES[ROOT_CATEGORY_HUE[rootSlug] ?? DEFAULT_HUE];
  return {
    background: `oklch(0.79 0.14 ${hue})`,
    shapeColor: `oklch(0.67 0.18 ${hue})`,
    shape: shapeFor(product.id),
    glyph: getGlyph(product),
  };
}
