-- Seeds · 008 · Serveis assignats al rider d'exemple (US-14, US-15, US-09) en estats diferents, el 14, 15 i
-- 16/06/2030, i un servei d'una reserva cancel·lada. La recollida de Mobiliario Turia (17/06)
-- queda pendent perquè es pugui acceptar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM deliveries WHERE rider_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

-- Reserva confirmada dels seeds: els dos lliuraments i la recollida de Sonido Levante.
UPDATE deliveries SET status = 'assigned', rider_id = 'b0000000-0000-4000-8000-000000000004', assigned_at = now() - interval '1 day'
WHERE event_id = 'f0000000-0000-4000-8000-000000000001'
  AND (delivery_type = 'delivery' OR seller_id = 'a0000000-0000-4000-8000-000000000001');

-- Des que els va acceptar no han canviat.
UPDATE deliveries SET changed_at = assigned_at WHERE rider_id IS NOT NULL;

-- La franja de la recollida de Sonido es va moure després que el rider l'acceptés.
UPDATE deliveries SET time_window = tstzrange('2030-06-16 12:00 Europe/Madrid', '2030-06-16 14:00 Europe/Madrid', '[)')
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'pickup' AND seller_id = 'a0000000-0000-4000-8000-000000000001';

-- Una reserva cancel·lada amb el lliurament que el rider ja havia acceptat.
INSERT INTO events (id, customer_id, status, starts_at, ends_at, address_id) VALUES
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'cancelled',
   '2030-06-15 18:00 Europe/Madrid', '2030-06-15 23:00 Europe/Madrid', 'a1000000-0000-4000-8000-000000000001');
INSERT INTO event_items (id, event_id, product_id, quantity) VALUES
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000009', 20);
INSERT INTO deliveries (id, event_id, seller_id, delivery_type, time_window, vehicle_type, status, rider_id, assigned_at) VALUES
  ('d2000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'delivery',
   tstzrange('2030-06-15 14:00 Europe/Madrid', '2030-06-15 16:00 Europe/Madrid', '[)'), 'car',
   'cancelled', 'b0000000-0000-4000-8000-000000000004', now() - interval '1 day');
