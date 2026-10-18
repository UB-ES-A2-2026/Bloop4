/** Producte amb la forma del contracte de GET /api/products; `overrides` substitueix camps. */
export function makeProduct(overrides = {}) {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    name: 'Altavoz activo 12" 1300 W',
    dailyPrice: '45.00',
    currency: 'EUR',
    category: { id: 'c0000000-0000-4000-8000-000000000002', name: 'Altavoces', slug: 'altavoces' },
    parentCategory: { id: 'c0000000-0000-4000-8000-000000000001', name: 'Sonido', slug: 'sonido' },
    seller: { id: 'a0000000-0000-4000-8000-000000000001', legalName: 'Sonido Levante S.L.', city: 'Valencia' },
    ...overrides,
  };
}

/** Pàgina de resposta de l'API amb `count` productes d'ids diferents. */
export function makePage(count, { page = 1, totalItems = count, firstIndex = 0 } = {}) {
  const data = Array.from({ length: count }, (_, i) =>
    makeProduct({
      id: `d0000000-0000-4000-8000-${String(firstIndex + i + 1).padStart(12, '0')}`,
      name: `Producto ${firstIndex + i + 1}`,
    }),
  );
  return { data, pagination: { page, pageSize: 24, totalItems, totalPages: Math.ceil(totalItems / 24) } };
}
