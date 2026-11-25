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

/** Categories amb la forma de GET /api/categories: 2 arrels amb subcategories. */
export function makeCategories() {
  return [
    { id: 'c-sonido', parentId: null, name: 'Sonido', slug: 'sonido', sortOrder: 1, productCount: 0 },
    { id: 'c-altavoces', parentId: 'c-sonido', name: 'Altavoces', slug: 'altavoces', sortOrder: 1, productCount: 2 },
    { id: 'c-microfonia', parentId: 'c-sonido', name: 'Microfonía', slug: 'microfonia', sortOrder: 2, productCount: 2 },
    { id: 'c-mobiliario', parentId: null, name: 'Mobiliario', slug: 'mobiliario', sortOrder: 2, productCount: 0 },
    { id: 'c-sillas', parentId: 'c-mobiliario', name: 'Sillas', slug: 'sillas', sortOrder: 1, productCount: 2 },
  ];
}

/** Reserva amb la forma de GET /api/bookings/:id (pendent de pagament, un venedor, 2 altaveus). */
export function makeBooking(overrides = {}) {
  return {
    id: 'b1',
    bookingNumber: 'B4-2030-000007',
    status: 'pending_payment',
    holdExpiresAt: '2030-01-01T10:15:00Z',
    confirmedAt: null,
    startsAt: '2030-07-04T08:00:00.000Z',
    endsAt: '2030-07-05T08:00:00.000Z',
    billableDays: 1,
    currency: 'EUR',
    sellers: [
      {
        seller: { id: 's1', legalName: 'Sonido Levante S.L.', city: 'Valencia' },
        items: [{ id: 'i1', product: { id: 'p1', name: 'Altavoz activo' }, quantity: 2, currency: 'EUR', rentalSubtotal: '180.00' }],
        rentalSubtotal: '180.00',
        depositSubtotal: '300.00',
      },
    ],
    delivery: {
      address: { street: 'Calle Ficticia 9', postalCode: '46001', city: 'Valencia', accessInstructions: null },
      deliveryWindow: { startsAt: '2030-07-04T06:00:00.000Z', endsAt: '2030-07-04T08:00:00.000Z' },
      pickupWindow: { startsAt: '2030-07-05T10:00:00.000Z', endsAt: '2030-07-05T12:00:00.000Z' },
      transport: [],
      transportTotal: '25.00',
    },
    totals: { rental: '180.00', deposit: '300.00', transport: '25.00', toPay: '205.00' },
    ...overrides,
  };
}

/** Servei de lliurament o recollida amb la forma de GET /api/rider/services/available. */
export function makeService(overrides = {}) {
  return {
    id: 's1',
    type: 'delivery',
    status: 'pending',
    timeWindow: { startsAt: '2030-06-15T06:00:00.000Z', endsAt: '2030-06-15T08:00:00.000Z' },
    zone: { postalCode: '46001', city: 'Valencia' },
    vehicle: { type: 'van', name: 'Furgoneta' },
    seller: { id: 'a1', legalName: 'Sonido Levante S.L.', city: 'Valencia' },
    items: [{ name: 'Altavoz activo', quantity: 3 }],
    fitsVehicle: true,
    scheduleConflict: false,
    ...overrides,
  };
}

/** Servei assignat al rider, amb la forma de GET /api/rider/services/:id. */
export function makeAssignedService(overrides = {}) {
  return makeService({
    status: 'assigned',
    bookingNumber: 'B4-2030-000001',
    assignedAt: '2030-06-01T08:00:00.000Z',
    changedSinceAssigned: false,
    address: { street: 'Calle Ficticia 1', postalCode: '46001', city: 'Valencia', accessInstructions: 'Portón verde' },
    customer: { fullName: 'Laura Cliente' },
    // Amb l'id de cada línia, que el rider fa servir per a les fotos i el checklist.
    items: [{ eventItemId: 'i1', name: 'Altavoz activo', quantity: 3 }],
    ...overrides,
  });
}
