-- Proves d'integritat dels pagaments i de la fiança (011, US-08).
-- (El runner hi posa _helpers.sql al davant.)

INSERT INTO payments (event_id, provider, provider_ref, checkout_url, amount, currency)
VALUES ('f0000000-0000-4000-8000-000000000001', 'mock', 'mock_cs_test_1', 'http://localhost/pago', 205.00, 'EUR');

SELECT pg_temp.expect_error('una reserva no pot tenir dos pagaments en curs', '23505',
  $$INSERT INTO payments (event_id, provider, provider_ref, checkout_url, amount, currency)
    VALUES ('f0000000-0000-4000-8000-000000000001', 'mock', 'mock_cs_test_2', 'http://localhost/pago', 205.00, 'EUR')$$);

SELECT pg_temp.expect_error('la referència de la passarel·la no es repeteix', '23505',
  $$INSERT INTO payments (event_id, provider, provider_ref, checkout_url, amount, currency, status)
    VALUES ('f0000000-0000-4000-8000-000000000002', 'mock', 'mock_cs_test_1', 'http://localhost/pago', 10.00, 'EUR', 'failed')$$);

SELECT pg_temp.expect_error('un pagament completat necessita la data i el número de comprovant', '23514',
  $$UPDATE payments SET status = 'succeeded' WHERE provider_ref = 'mock_cs_test_1'$$);

UPDATE payments SET status = 'succeeded', paid_at = now(), receipt_number = 'R-2030-000001' WHERE provider_ref = 'mock_cs_test_1';
SELECT pg_temp.expect_error('una reserva no es pot cobrar dues vegades', '23505',
  $$INSERT INTO payments (event_id, provider, provider_ref, checkout_url, amount, currency, status, paid_at, receipt_number)
    VALUES ('f0000000-0000-4000-8000-000000000001', 'mock', 'mock_cs_test_3', 'http://localhost/pago', 205.00, 'EUR', 'succeeded', now(), 'R-2030-000002')$$);

SELECT pg_temp.expect_error('l''import d''un pagament és positiu', '23514',
  $$INSERT INTO payments (event_id, provider, provider_ref, checkout_url, amount, currency, status)
    VALUES ('f0000000-0000-4000-8000-000000000002', 'mock', 'mock_cs_test_4', 'http://localhost/pago', 0, 'EUR', 'failed')$$);

SELECT pg_temp.expect_error('una fiança retinguda necessita la referència de la passarel·la', '23514',
  $$INSERT INTO deposit_holds (event_id, amount, currency, status, scheduled_for, provider)
    VALUES ('f0000000-0000-4000-8000-000000000001', 300.00, 'EUR', 'held', now(), 'mock')$$);

INSERT INTO payment_webhook_events (provider, event_ref) VALUES ('mock', 'evt_test_1');
SELECT pg_temp.expect_error('un avís de la passarel·la només es registra una vegada', '23505',
  $$INSERT INTO payment_webhook_events (provider, event_ref) VALUES ('mock', 'evt_test_1')$$);

SELECT pg_temp.assert('cap taula de pagaments té columnes de targeta',
  NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name IN ('payments', 'deposit_holds') AND column_name ~ '(card|pan|cvc|cvv|expiry)'));

ROLLBACK;
