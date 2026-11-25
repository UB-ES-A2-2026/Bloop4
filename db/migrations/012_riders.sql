-- 012 · Acceptació dels serveis de lliurament i recollida pel rider (US-14).
-- Els riders i l'assignació dels serveis (`deliveries.rider_id`, `assigned_at`) són a la 009. Aquí,
-- el que és propi de l'acceptació: un rider no pot tenir dos serveis que se solapin i la llista de
-- serveis pendents per data.

ALTER TABLE deliveries
  -- Un rider no pot tenir dos serveis actius que se solapin en el temps (SQLSTATE 23P01).
  ADD CONSTRAINT deliveries_rider_no_overlap
    EXCLUDE USING gist (rider_id WITH =, time_window WITH &&) WHERE (rider_id IS NOT NULL AND status <> 'cancelled');

-- Serveis pendents per data (llista de serveis disponibles).
CREATE INDEX IF NOT EXISTS deliveries_pending_idx ON deliveries (lower(time_window)) WHERE status = 'pending';
