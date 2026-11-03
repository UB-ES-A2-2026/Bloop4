-- Seeds · 006 · Zones de repartiment dels venedors d'exemple (València i voltants) i el
-- lliurament i la recollida de la reserva confirmada del 15/06/2030. L'adreça és inventada.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM seller_postal_codes) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

-- Tots dos reparteixen a la ciutat de València (46001–46026); cadascú, també al seu poble.
INSERT INTO seller_postal_codes (seller_id, postal_code)
SELECT s.id, lpad((46000 + n)::text, 5, '0')
FROM sellers s CROSS JOIN generate_series(1, 26) AS n
WHERE s.id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');
INSERT INTO seller_postal_codes (seller_id, postal_code) VALUES
  ('a0000000-0000-4000-8000-000000000001', '46980'),  -- Paterna
  ('a0000000-0000-4000-8000-000000000002', '46930');  -- Quart de Poblet

INSERT INTO addresses (id, user_id, street, postal_code, city, access_instructions) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Calle Ficticia 1', '46001', 'Valencia', 'Portón verde, preguntar por la organizadora');
UPDATE events SET address_id = 'a1000000-0000-4000-8000-000000000001'
WHERE id = 'f0000000-0000-4000-8000-000000000001';

INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'delivery',
   tstzrange('2030-06-15 08:00 Europe/Madrid', '2030-06-15 10:00 Europe/Madrid', '[)'), 'car'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'pickup',
   tstzrange('2030-06-16 10:00 Europe/Madrid', '2030-06-16 12:00 Europe/Madrid', '[)'), 'car'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'delivery',
   tstzrange('2030-06-14 08:00 Europe/Madrid', '2030-06-14 10:00 Europe/Madrid', '[)'), 'van'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'pickup',
   tstzrange('2030-06-17 10:00 Europe/Madrid', '2030-06-17 12:00 Europe/Madrid', '[)'), 'van');

INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'car', 25.00, 'EUR'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'van', 45.00, 'EUR');
