-- Proves d'integritat de l'esquema comú del Sprint 2 (009) i de les dades d'exemple de cada història.
-- (El runner hi posa _helpers.sql al davant.)

-- Estats dels seeds per a cada història -----------------------------------------
SELECT pg_temp.assert('el rider dels seeds té els serveis del 14–16/06 assignats, 1 de cancel·lat i 2 lliuraments en curs',
  (SELECT count(*) FROM deliveries WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND rider_id = 'b0000000-0000-4000-8000-000000000004' AND status = 'assigned') = 3
  AND (SELECT count(*) FROM deliveries WHERE rider_id = 'b0000000-0000-4000-8000-000000000004' AND status = 'cancelled') = 1
  AND (SELECT count(*) FROM deliveries WHERE event_id = 'f0000000-0000-4000-8000-000000000006' AND status = 'in_transit' AND delivery_type = 'delivery') = 2);

SELECT pg_temp.assert('hi ha recollides pendents de reserves confirmades que un rider pot acceptar',
  (SELECT count(*) FROM deliveries d JOIN events e ON e.id = d.event_id
   WHERE d.status = 'pending' AND e.status = 'confirmed') = 2);

SELECT pg_temp.assert('la reserva pendent de pagament dels seeds té el bloqueig vigent i una unitat bloquejada',
  (SELECT status = 'pending_payment' AND hold_expires_at > now() FROM events WHERE id = 'f0000000-0000-4000-8000-000000000007')
  AND (SELECT count(*) FROM event_item_units u JOIN event_items i ON i.id = u.event_item_id
       WHERE i.event_id = 'f0000000-0000-4000-8000-000000000007' AND u.is_active) = 1);

SELECT pg_temp.assert('les dues reserves finalitzades tenen el lliurament i la recollida fets',
  (SELECT count(*) FROM deliveries d JOIN events e ON e.id = d.event_id
   WHERE e.status = 'completed' AND d.status = 'delivered') = 4);

-- Reserves --------------------------------------------------------------------
SELECT pg_temp.assert('la reserva confirmada dels seeds té número de reserva',
  (SELECT booking_number ~ '^B4-[0-9]{4}-[0-9]{6}$' FROM events WHERE id = 'f0000000-0000-4000-8000-000000000001'));

WITH e AS (INSERT INTO events (customer_id, status, hold_expires_at)
           VALUES ('b0000000-0000-4000-8000-000000000003', 'pending_payment', now() + interval '15 minutes')
           RETURNING booking_number)
SELECT pg_temp.assert('una reserva cancel·lada no té número de reserva i una de nova en rep un',
  (SELECT booking_number IS NULL FROM events WHERE id = 'f0000000-0000-4000-8000-000000000002')
  AND (SELECT booking_number ~ '^B4-[0-9]{4}-[0-9]{6}$' FROM e));

SELECT pg_temp.expect_error('una reserva pendent de pagament necessita la caducitat del bloqueig', '23514',
  $$INSERT INTO events (customer_id, status) VALUES ('b0000000-0000-4000-8000-000000000001', 'pending_payment')$$);

-- Riders i serveis ------------------------------------------------------------
SELECT pg_temp.assert('els seeds tenen 2 riders amb vehicle',
  (SELECT count(*) FROM riders) = 2);

SELECT pg_temp.expect_error('només un usuari amb el rol rider pot tenir perfil de rider', '23514',
  $$INSERT INTO riders (user_id, vehicle_type) VALUES ('b0000000-0000-4000-8000-000000000001', 'car')$$);

SELECT pg_temp.expect_error('un servei pendent no pot tenir rider', '23514',
  $$UPDATE deliveries SET rider_id = 'b0000000-0000-4000-8000-000000000004'
    WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'pickup'
      AND seller_id = 'a0000000-0000-4000-8000-000000000002'$$);

SELECT pg_temp.expect_error('un servei assignat necessita rider', '23514',
  $$UPDATE deliveries SET status = 'assigned'
    WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'pickup'
      AND seller_id = 'a0000000-0000-4000-8000-000000000002'$$);

-- Un servei que acaba de crear-se no té rider; quan s'assigna, sí.
WITH d AS (UPDATE deliveries SET status = 'assigned', rider_id = 'b0000000-0000-4000-8000-000000000006', assigned_at = now()
           WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'pickup' AND seller_id = 'a0000000-0000-4000-8000-000000000002'
           RETURNING status)
SELECT pg_temp.assert('un servei assignat amb rider i data d''assignació és vàlid', (SELECT status = 'assigned' FROM d));

SELECT pg_temp.assert('la recollida que es va moure consta com a modificada després d''acceptar-la',
  (SELECT changed_at > assigned_at FROM deliveries
   WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'pickup'
     AND seller_id = 'a0000000-0000-4000-8000-000000000001'));

UPDATE deliveries SET changed_at = '2000-01-01' WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery';
UPDATE deliveries SET status = 'cancelled' WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
  AND seller_id = 'a0000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert('canviar l''estat d''un servei n''actualitza changed_at i res més no',
  (SELECT changed_at > '2000-01-01' FROM deliveries WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
     AND seller_id = 'a0000000-0000-4000-8000-000000000001')
  AND (SELECT changed_at = '2000-01-01' FROM deliveries WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
     AND seller_id = 'a0000000-0000-4000-8000-000000000002'));

-- Avisos ------------------------------------------------------------------------
SELECT pg_temp.expect_error('un avís només enllaça rutes de l''app', '23514',
  $$INSERT INTO notifications (user_id, kind, title, link)
    VALUES ('b0000000-0000-4000-8000-000000000001', 'service_status', 'Hola', 'https://example.com')$$);

SELECT pg_temp.expect_error('un avís necessita títol', '23514',
  $$INSERT INTO notifications (user_id, kind, title) VALUES ('b0000000-0000-4000-8000-000000000001', 'service_status', ' ')$$);

ROLLBACK;
