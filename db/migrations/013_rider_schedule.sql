-- 013 · Llista de lliuraments i recollides del rider (US-15).
-- Índex per consultar els serveis d'un rider per dia. `changed_at` (l'últim canvi de la franja o de
-- l'estat d'un servei, perquè el rider vegi si un servei seu s'ha modificat o cancel·lat) és a la 009.

CREATE INDEX IF NOT EXISTS deliveries_rider_window_idx ON deliveries (rider_id, lower(time_window)) WHERE rider_id IS NOT NULL;
