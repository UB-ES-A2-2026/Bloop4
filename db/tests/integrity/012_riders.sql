-- Proves d'integritat de l'acceptació de serveis pel rider (012, US-14).
-- (El runner hi posa _helpers.sql al davant.)

-- Els dos lliuraments de la reserva dels seeds (14/06 i 15/06) no se solapen: el rider els té tots dos.
SELECT pg_temp.assert('un rider pot tenir serveis que no se solapen',
  (SELECT count(*) FROM deliveries WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
     AND rider_id = 'b0000000-0000-4000-8000-000000000004' AND status = 'assigned') = 2);

SELECT pg_temp.expect_error('un rider no pot tenir dos serveis que se solapin', '23P01',
  $$INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type, status, rider_id, assigned_at)
    VALUES ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'delivery',
            tstzrange('2030-06-15 09:00 Europe/Madrid', '2030-06-15 11:00 Europe/Madrid', '[)'), 'car',
            'assigned', 'b0000000-0000-4000-8000-000000000004', now())$$);

WITH d AS (INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type, status, rider_id, assigned_at)
           VALUES ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'delivery',
                   tstzrange('2030-06-15 09:00 Europe/Madrid', '2030-06-15 11:00 Europe/Madrid', '[)'), 'car',
                   'cancelled', 'b0000000-0000-4000-8000-000000000004', now())
           RETURNING id)
SELECT pg_temp.assert('un servei cancel·lat no ocupa l''horari del rider', (SELECT count(*) = 1 FROM d));

SELECT pg_temp.assert('existeix l''índex dels serveis pendents per data',
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'deliveries_pending_idx'));

ROLLBACK;
