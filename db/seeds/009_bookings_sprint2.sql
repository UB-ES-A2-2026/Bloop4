-- Seeds · 009 · Reserves del Sprint 2 en els estats que necessita cada història, perquè cadascuna
-- es pugui provar sola (en local, a la CI i en revisar-la) sense passar per les pantalles de les altres:
--   · f…004 i f…005: reserves finalitzades a l'octubre de 2026, amb el lliurament i la recollida
--     fets (US-04 hi valora els productes).
--   · f…006: reserva confirmada del 20/07/2030 amb els dos lliuraments en curs (US-11 en completa el de
--     Mobiliario Turia amb la prova; US-16 comparteix la ubicació del de Sonido Levante), la recollida
--     de Sonido assignada i la de Mobiliario pendent (US-14 la pot acceptar).
--   · f…007: reserva pendent de pagament del 08/08/2030 amb una unitat bloquejada (US-08 la paga).
-- Tots els serveis són del rider d'exemple (rider@example.com, furgoneta).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE id = 'f0000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

INSERT INTO addresses (id, user_id, street, postal_code, city) VALUES
  ('a1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'Calle Inventada 7', '46002', 'Valencia');

-- Reserves finalitzades (octubre de 2026) ------------------------------------
INSERT INTO events (id, customer_id, status, starts_at, ends_at, address_id, confirmed_at) VALUES
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'completed',
   '2026-10-10 18:00 Europe/Madrid', '2026-10-11 02:00 Europe/Madrid', 'a1000000-0000-4000-8000-000000000001', '2026-10-01 10:00 Europe/Madrid'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'completed',
   '2026-10-17 18:00 Europe/Madrid', '2026-10-18 02:00 Europe/Madrid', 'a1000000-0000-4000-8000-000000000002', '2026-10-05 10:00 Europe/Madrid');

INSERT INTO event_items (id, event_id, product_id, quantity) VALUES
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 2),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 2),
  ('f1000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 1);

-- Lliurament i recollida fets pel rider d'exemple.
INSERT INTO deliveries (id, event_id, seller_id, delivery_type, time_window, vehicle_type, status, rider_id, assigned_at) VALUES
  ('d2000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'delivery',
   tstzrange('2026-10-10 14:00 Europe/Madrid', '2026-10-10 16:00 Europe/Madrid', '[)'), 'car', 'delivered', 'b0000000-0000-4000-8000-000000000004', '2026-10-02 10:00 Europe/Madrid'),
  ('d2000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'pickup',
   tstzrange('2026-10-11 10:00 Europe/Madrid', '2026-10-11 12:00 Europe/Madrid', '[)'), 'car', 'delivered', 'b0000000-0000-4000-8000-000000000004', '2026-10-02 10:00 Europe/Madrid'),
  ('d2000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'delivery',
   tstzrange('2026-10-17 14:00 Europe/Madrid', '2026-10-17 16:00 Europe/Madrid', '[)'), 'car', 'delivered', 'b0000000-0000-4000-8000-000000000004', '2026-10-06 10:00 Europe/Madrid'),
  ('d2000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'pickup',
   tstzrange('2026-10-18 10:00 Europe/Madrid', '2026-10-18 12:00 Europe/Madrid', '[)'), 'car', 'delivered', 'b0000000-0000-4000-8000-000000000004', '2026-10-06 10:00 Europe/Madrid');

-- Reserva confirmada amb els lliuraments en curs (20/07/2030) ----------------
INSERT INTO events (id, customer_id, status, starts_at, ends_at, address_id, confirmed_at) VALUES
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'confirmed',
   '2030-07-20 18:00 Europe/Madrid', '2030-07-21 02:00 Europe/Madrid', 'a1000000-0000-4000-8000-000000000001', now() - interval '3 days');

-- Les línies guarden el preu i la fiança del moment de la reserva, com les que crea la cistella.
INSERT INTO event_items (id, event_id, product_id, quantity, daily_price, deposit_amount, currency, insurance)
SELECT v.id::uuid, 'f0000000-0000-4000-8000-000000000006', p.id, v.quantity, p.daily_price, p.deposit_amount, p.currency, p.insurance
FROM (VALUES ('f1000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000001', 1),
             ('f1000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000009', 10)) AS v (id, product_id, quantity)
JOIN products p ON p.id = v.product_id::uuid;

-- Unitats ocupades del principi del lliurament al final de la recollida de cada venedor.
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT 'f1000000-0000-4000-8000-000000000008', u.id,
       tstzrange('2030-07-20 08:00 Europe/Madrid', '2030-07-21 12:00 Europe/Madrid', '[)')
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000001' AND u.status = 'available'
ORDER BY u.id LIMIT 1;
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT 'f1000000-0000-4000-8000-000000000009', u.id,
       tstzrange('2030-07-20 10:00 Europe/Madrid', '2030-07-21 14:00 Europe/Madrid', '[)')
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000009' AND u.status = 'available'
ORDER BY u.id LIMIT 10;

INSERT INTO deliveries (id, event_id, seller_id, delivery_type, time_window, vehicle_type, status, rider_id, assigned_at) VALUES
  ('d2000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'delivery',
   tstzrange('2030-07-20 08:00 Europe/Madrid', '2030-07-20 10:00 Europe/Madrid', '[)'), 'car',
   'in_transit', 'b0000000-0000-4000-8000-000000000004', now() - interval '2 days'),
  ('d2000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'delivery',
   tstzrange('2030-07-20 10:00 Europe/Madrid', '2030-07-20 12:00 Europe/Madrid', '[)'), 'van',
   'in_transit', 'b0000000-0000-4000-8000-000000000004', now() - interval '2 days'),
  ('d2000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'pickup',
   tstzrange('2030-07-21 10:00 Europe/Madrid', '2030-07-21 12:00 Europe/Madrid', '[)'), 'car',
   'assigned', 'b0000000-0000-4000-8000-000000000004', now() - interval '2 days');
INSERT INTO deliveries (id, event_id, seller_id, delivery_type, time_window, vehicle_type) VALUES
  ('d2000000-0000-4000-8000-000000000013', 'f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'pickup',
   tstzrange('2030-07-21 12:00 Europe/Madrid', '2030-07-21 14:00 Europe/Madrid', '[)'), 'van');
-- Des que el rider els va acceptar no han canviat.
UPDATE deliveries SET changed_at = assigned_at WHERE event_id = 'f0000000-0000-4000-8000-000000000006' AND rider_id IS NOT NULL;

INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) VALUES
  ('f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'car', 25.00, 'EUR'),
  ('f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'van', 45.00, 'EUR');

-- Reserva pendent de pagament (08/08/2030) -----------------------------------
-- El bloqueig dura més dels 15 minuts habituals perquè la reserva estigui a punt per pagar quan es
-- revisa la història; quan caduca, l'API la torna a deixar com a cistella.
INSERT INTO events (id, customer_id, status, starts_at, ends_at, address_id, hold_expires_at) VALUES
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'pending_payment',
   '2030-08-08 18:00 Europe/Madrid', '2030-08-09 02:00 Europe/Madrid', 'a1000000-0000-4000-8000-000000000001', now() + interval '7 days');

INSERT INTO event_items (id, event_id, product_id, quantity, daily_price, deposit_amount, currency, insurance)
SELECT 'f1000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000007', p.id, 1, p.daily_price, p.deposit_amount, p.currency, p.insurance
FROM products p WHERE p.id = 'd0000000-0000-4000-8000-000000000001';

INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT 'f1000000-0000-4000-8000-000000000010', u.id,
       tstzrange('2030-08-08 08:00 Europe/Madrid', '2030-08-09 12:00 Europe/Madrid', '[)')
FROM product_units u
WHERE u.product_id = 'd0000000-0000-4000-8000-000000000001' AND u.status = 'available'
ORDER BY u.id LIMIT 1;

INSERT INTO deliveries (id, event_id, seller_id, delivery_type, time_window, vehicle_type) VALUES
  ('d2000000-0000-4000-8000-000000000014', 'f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'delivery',
   tstzrange('2030-08-08 08:00 Europe/Madrid', '2030-08-08 10:00 Europe/Madrid', '[)'), 'car'),
  ('d2000000-0000-4000-8000-000000000015', 'f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'pickup',
   tstzrange('2030-08-09 10:00 Europe/Madrid', '2030-08-09 12:00 Europe/Madrid', '[)'), 'car');

INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) VALUES
  ('f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'car', 25.00, 'EUR');
