-- Seeds · 004 · Inventari dels venedors d'exemple (US-10): verificats, un magatzem cadascun,
-- productes publicats amb pes i mides, i les seves unitats físiques.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM warehouses) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

UPDATE sellers SET verified = true
WHERE id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');

INSERT INTO warehouses (id, seller_id, name, city) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Almacén Paterna',  'Paterna'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Almacén Quart',    'Quart de Poblet');

-- Pes (kg) i mides (cm) de transport, i quantes unitats té cada producte.
UPDATE products p SET
  status = 'published', weight_kg = d.weight_kg, length_cm = d.length_cm, width_cm = d.width_cm, height_cm = d.height_cm
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001',  18.0,  62,  38,  35),
  ('d0000000-0000-4000-8000-000000000002',  42.0,  70,  52,  60),
  ('d0000000-0000-4000-8000-000000000003',   6.0,  48,  38,  15),
  ('d0000000-0000-4000-8000-000000000004',   1.0,  30,  20,  10),
  ('d0000000-0000-4000-8000-000000000005',   1.0,  30,  20,  10),
  ('d0000000-0000-4000-8000-000000000006',   3.0,  30,  30,  25),
  ('d0000000-0000-4000-8000-000000000007',  16.0,  45,  35,  55),
  ('d0000000-0000-4000-8000-000000000008',   9.0,  55,  30,  30),
  ('d0000000-0000-4000-8000-000000000009',   4.0,  40,  42,  92),
  ('d0000000-0000-4000-8000-000000000010',   4.5,  45,  47,  80),
  ('d0000000-0000-4000-8000-000000000011',  28.0, 180, 180,  74),
  ('d0000000-0000-4000-8000-000000000012',  35.0, 240, 100,  74),
  ('d0000000-0000-4000-8000-000000000013',  35.0, 150,  25,  25),
  ('d0000000-0000-4000-8000-000000000014', 120.0, 200,  60,  60),
  ('d0000000-0000-4000-8000-000000000015',  48.0, 200, 100,  10)
) AS d (id, weight_kg, length_cm, width_cm, height_cm)
WHERE p.id = d.id::uuid;

INSERT INTO product_units (product_id, seller_id, warehouse_id)
SELECT p.id, p.seller_id, w.id
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001',   4),
  ('d0000000-0000-4000-8000-000000000002',   2),
  ('d0000000-0000-4000-8000-000000000003',   2),
  ('d0000000-0000-4000-8000-000000000004',   6),
  ('d0000000-0000-4000-8000-000000000005',   4),
  ('d0000000-0000-4000-8000-000000000006',  12),
  ('d0000000-0000-4000-8000-000000000007',   4),
  ('d0000000-0000-4000-8000-000000000008',   2),
  ('d0000000-0000-4000-8000-000000000009', 100),
  ('d0000000-0000-4000-8000-000000000010', 150),
  ('d0000000-0000-4000-8000-000000000011',  20),
  ('d0000000-0000-4000-8000-000000000012',  10),
  ('d0000000-0000-4000-8000-000000000013',   6),
  ('d0000000-0000-4000-8000-000000000014',   2),
  ('d0000000-0000-4000-8000-000000000015',  12)
) AS u (product_id, units)
JOIN products p   ON p.id = u.product_id::uuid
JOIN warehouses w ON w.seller_id = p.seller_id
CROSS JOIN generate_series(1, u.units);

-- Una unitat de la carpa jaima és en manteniment: no compta per a la disponibilitat (US-05).
UPDATE product_units SET status = 'maintenance'
WHERE id = (SELECT id FROM product_units WHERE product_id = 'd0000000-0000-4000-8000-000000000014' ORDER BY id LIMIT 1);
