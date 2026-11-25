-- Proves d'integritat del seguiment dels serveis (014, US-09).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.assert('cada servei dels seeds té almenys una entrada a l''historial',
  NOT EXISTS (SELECT 1 FROM deliveries d WHERE NOT EXISTS (SELECT 1 FROM delivery_status_history h WHERE h.delivery_id = d.id)));

UPDATE deliveries SET status = 'in_transit'
WHERE event_id = 'f0000000-0000-4000-8000-000000000001' AND delivery_type = 'delivery'
  AND seller_id = 'a0000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert('un canvi d''estat queda a l''historial',
  (SELECT h.status FROM delivery_status_history h JOIN deliveries d ON d.id = h.delivery_id
   WHERE d.event_id = 'f0000000-0000-4000-8000-000000000001' AND d.delivery_type = 'delivery'
     AND d.seller_id = 'a0000000-0000-4000-8000-000000000001'
   ORDER BY h.id DESC LIMIT 1) = 'in_transit');

ROLLBACK;
