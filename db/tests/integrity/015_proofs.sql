-- Proves d'integritat de les proves de lliurament i les incidències (015, US-11).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.expect_error('una foto només pot ser d''una línia del mateix servei', '23514',
  $$INSERT INTO proof_photos (delivery_id, event_item_id, path, content_type)
    SELECT d.id, 'f1000000-0000-4000-8000-000000000002',
           '00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.jpg', 'image/jpeg'
    FROM deliveries d WHERE d.event_id = 'f0000000-0000-4000-8000-000000000001'
      AND d.seller_id = 'a0000000-0000-4000-8000-000000000001' AND d.delivery_type = 'delivery'$$);

SELECT pg_temp.expect_error('la ruta d''una foto la genera el servidor (sense ../)', '23514',
  $$INSERT INTO proof_photos (delivery_id, path, content_type)
    SELECT id, '../../etc/passwd', 'image/jpeg' FROM deliveries LIMIT 1$$);

INSERT INTO delivery_proofs (delivery_id, rider_id)
SELECT id, rider_id FROM deliveries
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND seller_id = 'a0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery';

SELECT pg_temp.expect_error('una línia danyada necessita una explicació', '23514',
  $$INSERT INTO proof_items (delivery_id, event_item_id, condition)
    SELECT delivery_id, 'f1000000-0000-4000-8000-000000000001', 'damaged' FROM delivery_proofs LIMIT 1$$);

SELECT pg_temp.expect_error('l''estat d''una línia és correcte, danyat o incomplet', '23514',
  $$INSERT INTO proof_items (delivery_id, event_item_id, condition)
    SELECT delivery_id, 'f1000000-0000-4000-8000-000000000001', 'perdut' FROM delivery_proofs LIMIT 1$$);

SELECT pg_temp.expect_error('una incidència resolta necessita qui i quan', '23514',
  $$INSERT INTO incidents (delivery_id, kind, description, status)
    SELECT id, 'other', 'Prova', 'resolved' FROM deliveries LIMIT 1$$);

ROLLBACK;
