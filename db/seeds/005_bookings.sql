-- Seeds · 005 · Reserves d'exemple per provar la disponibilitat (US-05), el 15/06/2030
-- (hora de Madrid). Les dates són llunyanes perquè l'API no admet consultes del passat.
--   · Altavoz activo 12" (4 unitats): 3 reservades de 10:00 a 02:00 de l'endemà.
--   · Carpa jaima (2 unitats, 1 en manteniment): la que queda, reservada tot el cap de setmana.
--   · Una reserva cancel·lada (is_active = false) que no ha de comptar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

INSERT INTO events (id, customer_id, status, starts_at, ends_at) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'confirmed',
   '2030-06-15 12:00 Europe/Madrid', '2030-06-16 00:00 Europe/Madrid'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'cancelled',
   '2030-06-22 12:00 Europe/Madrid', '2030-06-23 00:00 Europe/Madrid');

INSERT INTO event_items (id, event_id, product_id, quantity) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 3),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000014', 1),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 4);

-- Altavoz: les 3 primeres unitats disponibles.
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT 'f1000000-0000-4000-8000-000000000001', u.id,
       tstzrange('2030-06-15 10:00 Europe/Madrid', '2030-06-16 02:00 Europe/Madrid', '[)')
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000001' AND u.status = 'available'
ORDER BY u.id LIMIT 3;

-- Carpa jaima: l'única unitat que no és en manteniment.
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT 'f1000000-0000-4000-8000-000000000002', u.id,
       tstzrange('2030-06-14 08:00 Europe/Madrid', '2030-06-17 12:00 Europe/Madrid', '[)')
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000014' AND u.status = 'available';

-- Reserva cancel·lada: les 4 unitats de l'altaveu el 22/06, inactives.
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period, is_active)
SELECT 'f1000000-0000-4000-8000-000000000003', u.id,
       tstzrange('2030-06-22 10:00 Europe/Madrid', '2030-06-23 02:00 Europe/Madrid', '[)'), false
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000001';
