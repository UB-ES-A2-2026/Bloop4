-- Proves d'integritat de la llista de serveis del rider (013, US-15).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.assert('existeix l''índex dels serveis de cada rider per dia',
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'deliveries_rider_window_idx'
          AND indexdef LIKE '%(rider_id, lower(time_window))%'));

SELECT pg_temp.assert('la consulta dels serveis d''un rider per dia pot fer servir l''índex',
  (SELECT count(*) FROM deliveries
   WHERE rider_id = 'b0000000-0000-4000-8000-000000000004'
     AND lower(time_window) >= '2030-06-15 00:00 Europe/Madrid' AND lower(time_window) < '2030-06-16 00:00 Europe/Madrid') = 2);

ROLLBACK;
