-- Proves d'integritat de la ubicació del rider (016, US-16).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.expect_error('no es guarda la posició d''un lliurament que no és en curs', '23514',
  $$INSERT INTO rider_locations (delivery_id, rider_id, latitude, longitude)
    SELECT id, rider_id, 39.47, -0.37 FROM deliveries
    WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
      AND seller_id = 'a0000000-0000-4000-8000-000000000002'$$);

UPDATE deliveries SET status = 'in_transit'
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
  AND seller_id = 'a0000000-0000-4000-8000-000000000002';

SELECT pg_temp.expect_error('un altre rider no pot guardar la posició d''un lliurament', '23514',
  $$INSERT INTO rider_locations (delivery_id, rider_id, latitude, longitude)
    SELECT id, 'b0000000-0000-4000-8000-000000000006', 39.47, -0.37 FROM deliveries
    WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
      AND seller_id = 'a0000000-0000-4000-8000-000000000002'$$);

SELECT pg_temp.expect_error('la latitud és entre -90 i 90', '23514',
  $$INSERT INTO rider_locations (delivery_id, rider_id, latitude, longitude)
    SELECT id, rider_id, 91, -0.37 FROM deliveries
    WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
      AND seller_id = 'a0000000-0000-4000-8000-000000000002'$$);

INSERT INTO rider_locations (delivery_id, rider_id, latitude, longitude)
SELECT id, rider_id, 39.47, -0.37 FROM deliveries
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
  AND seller_id = 'a0000000-0000-4000-8000-000000000002';
UPDATE deliveries SET status = 'delivered'
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
  AND seller_id = 'a0000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert('quan el lliurament acaba, la posició del rider s''esborra',
  NOT EXISTS (SELECT 1 FROM rider_locations));

ROLLBACK;
