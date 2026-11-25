-- Seeds · 010 · Valoracions d'exemple (US-04). El client d'exemple i el compte de Mobiliario Turia
-- (que també és client) van llogar l'altaveu a les reserves finalitzades de l'octubre de 2026
-- (seeds 009); tots dos l'han valorat. La reserva del client també tenia micròfons, encara sense valorar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reviews) THEN
    RAISE EXCEPTION 'Los seeds ya están cargados. Usa ./db/reset.sh para empezar de cero.';
  END IF;
END $$;

INSERT INTO reviews (product_id, event_id, customer_id, rating, comment, created_at) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 5,
   'Sonó genial toda la noche y llegó puntual.', '2026-10-12 11:00 Europe/Madrid'),
  ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 4,
   NULL, '2026-10-19 09:30 Europe/Madrid');
