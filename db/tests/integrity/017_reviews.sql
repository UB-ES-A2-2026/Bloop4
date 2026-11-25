-- Proves d'integritat de les valoracions (017, US-04).
-- (El runner hi posa _helpers.sql al davant.)

SELECT pg_temp.assert('l''altaveu té 2 valoracions als seeds (mitjana 4,5)',
  (SELECT round(avg(rating), 1) FROM reviews WHERE product_id = 'd0000000-0000-4000-8000-000000000001' AND NOT hidden) = 4.5);

SELECT pg_temp.expect_error('un client només valora una vegada un producte de la mateixa reserva', '23505',
  $$INSERT INTO reviews (product_id, event_id, customer_id, rating)
    VALUES ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 3)$$);

SELECT pg_temp.expect_error('la puntuació és un enter d''1 a 5', '23514',
  $$INSERT INTO reviews (product_id, event_id, customer_id, rating)
    VALUES ('d0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 6)$$);

SELECT pg_temp.expect_error('el comentari té com a molt 1.000 caràcters', '23514',
  $$INSERT INTO reviews (product_id, event_id, customer_id, rating, comment)
    VALUES ('d0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 4, repeat('a', 1001))$$);

SELECT pg_temp.expect_error('no es pot valorar un producte d''una reserva no finalitzada', '23514',
  $$INSERT INTO reviews (product_id, event_id, customer_id, rating)
    VALUES ('d0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 4)$$);

SELECT pg_temp.expect_error('no es pot valorar un producte que no era a la reserva', '23514',
  $$INSERT INTO reviews (product_id, event_id, customer_id, rating)
    VALUES ('d0000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 4)$$);

SELECT pg_temp.expect_error('una valoració oculta necessita qui i quan', '23514',
  $$UPDATE reviews SET hidden = true WHERE event_id = 'f0000000-0000-4000-8000-000000000004'$$);

ROLLBACK;
