-- Proves d'integritat de la confirmació de la reserva (010, US-12).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.assert('existeix la restricció EXCLUDE contra les dobles reserves',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_item_units_no_overlap' AND contype = 'x')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'event_item_units_active_period_idx'));

SELECT pg_temp.expect_error('una unitat no pot tenir dues reserves actives que se solapin', '23P01',
  $$INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
    SELECT event_item_id, unit_id, tstzrange('2030-06-16 01:00 Europe/Madrid', '2030-06-16 05:00 Europe/Madrid', '[)')
    FROM event_item_units WHERE event_item_id = 'f1000000-0000-4000-8000-000000000001' LIMIT 1$$);

-- [inici, fi): una reserva que comença just quan acaba l'altra no se solapa; una d'inactiva, tampoc.
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period)
SELECT event_item_id, unit_id, tstzrange('2030-06-16 02:00 Europe/Madrid', '2030-06-16 05:00 Europe/Madrid', '[)')
FROM event_item_units WHERE event_item_id = 'f1000000-0000-4000-8000-000000000001' LIMIT 1;
INSERT INTO event_item_units (event_item_id, unit_id, reserved_period, is_active)
SELECT event_item_id, unit_id, tstzrange('2030-06-15 12:00 Europe/Madrid', '2030-06-15 14:00 Europe/Madrid', '[)'), false
FROM event_item_units WHERE event_item_id = 'f1000000-0000-4000-8000-000000000001' LIMIT 1;
SELECT pg_temp.assert('les reserves contigües i les inactives no entren en conflicte', true);

SELECT pg_temp.expect_error('la clau d''idempotència no es repeteix per client', '23505',
  $$INSERT INTO events (customer_id, status, checkout_key) VALUES
      ('b0000000-0000-4000-8000-000000000001', 'cancelled', 'clau-repetida'),
      ('b0000000-0000-4000-8000-000000000001', 'cancelled', 'clau-repetida')$$);

ROLLBACK;
