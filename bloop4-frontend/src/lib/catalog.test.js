import { describe, expect, it } from 'vitest';
import {
  buildCategoryTree,
  getActiveFilters,
  getSelectionState,
  selectableIds,
  toggleCategories,
} from './catalog';

// Mateixa forma que GET /api/categories (desordenat expressament).
const categories = [
  { id: 'mic', parentId: 'sonido', name: 'Microfonía', slug: 'microfonia', sortOrder: 3, productCount: 2 },
  { id: 'sonido', parentId: null, name: 'Sonido', slug: 'sonido', sortOrder: 1, productCount: 0 },
  { id: 'alt', parentId: 'sonido', name: 'Altavoces', slug: 'altavoces', sortOrder: 1, productCount: 2 },
  { id: 'mob', parentId: null, name: 'Mobiliario', slug: 'mobiliario', sortOrder: 3, productCount: 0 },
  { id: 'sillas', parentId: 'mob', name: 'Sillas', slug: 'sillas', sortOrder: 1, productCount: 2 },
  { id: 'buida', parentId: null, name: 'Sense filles', slug: 'sense-filles', sortOrder: 9, productCount: 1 },
];

const tree = buildCategoryTree(categories);
const sonido = tree[0];

describe('buildCategoryTree', () => {
  it('ordena pares i filles per sortOrder i suma els recomptes', () => {
    expect(tree.map((c) => c.id)).toEqual(['sonido', 'mob', 'buida']);
    expect(sonido.children.map((c) => c.id)).toEqual(['alt', 'mic']);
    expect(sonido.count).toBe(4);
    expect(tree[2].count).toBe(1);
  });
});

describe('selectableIds', () => {
  it('un pare representa les seves filles; una fulla, ella mateixa', () => {
    expect(selectableIds(sonido)).toEqual(['alt', 'mic']);
    expect(selectableIds(sonido.children[0])).toEqual(['alt']);
    expect(selectableIds(tree[2])).toEqual(['buida']);
  });
});

describe('toggleCategories', () => {
  it('completa el grup i el treu quan ja era complet', () => {
    const full = toggleCategories(['alt'], ['alt', 'mic']);
    expect(full).toEqual(['alt', 'mic']);
    expect(toggleCategories(full, ['alt', 'mic'])).toEqual([]);
  });
});

describe('getSelectionState / getActiveFilters', () => {
  it('distingeix none, some i all', () => {
    expect(getSelectionState(sonido, [])).toBe('none');
    expect(getSelectionState(sonido, ['alt'])).toBe('some');
    expect(getSelectionState(sonido, ['alt', 'mic'])).toBe('all');
  });

  it('agrupa un pare complet en un únic xip', () => {
    expect(getActiveFilters(tree, ['mic', 'alt', 'sillas']).map((f) => f.label)).toEqual(['Sonido', 'Mobiliario']);
    expect(getActiveFilters(tree, ['mic']).map((f) => f.label)).toEqual(['Microfonía']);
  });
});
