-- Proves d'integritat del catàleg. Necessiten els seeds carregats.
-- Tot passa dins d'una transacció que acaba en ROLLBACK: no modifica les dades.
-- Cada cas imprimeix "OK · ..." o avorta amb "ERROR · ...".
\set ON_ERROR_STOP 1
SET client_min_messages TO notice;

BEGIN;

-- Executa p_sql i espera que falli amb l'SQLSTATE indicat.
CREATE FUNCTION pg_temp.expect_error(p_label text, p_sqlstate text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_sqlstate THEN
      RAISE NOTICE 'OK · % (% %)', p_label, SQLSTATE, SQLERRM;
      RETURN;
    END IF;
    RAISE EXCEPTION 'ERROR · %: s''esperava % i ha arribat % (%)', p_label, p_sqlstate, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'ERROR · %: la sentència havia de fallar amb % i no ha fallat', p_label, p_sqlstate;
END $$;

CREATE FUNCTION pg_temp.assert(p_label text, p_condition boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'ERROR · %', p_label;
  END IF;
  RAISE NOTICE 'OK · %', p_label;
END $$;

-- Seeds ---------------------------------------------------------------------
SELECT pg_temp.assert('els seeds tenen 2 venedors, 14 categories i 15 productes',
  (SELECT count(*) FROM sellers) = 2
  AND (SELECT count(*) FROM categories) = 14
  AND (SELECT count(*) FROM products) = 15);

SELECT pg_temp.assert('l''arbre de categories només té dos nivells',
  NOT EXISTS (
    SELECT 1 FROM categories c JOIN categories p ON p.id = c.parent_id
    WHERE p.parent_id IS NOT NULL));

-- Categories ----------------------------------------------------------------
SELECT pg_temp.expect_error('una categoria no pot ser el seu propi pare', '23514',
  $$UPDATE categories SET parent_id = id WHERE slug = 'sonido'$$);

SELECT pg_temp.expect_error('l''slug de categoria és únic', '23505',
  $$INSERT INTO categories (name, slug) VALUES ('Sonido bis', 'sonido')$$);

SELECT pg_temp.expect_error('l''slug de categoria té format kebab-case', '23514',
  $$INSERT INTO categories (name, slug) VALUES ('Mal slug', 'Mal Slug')$$);

SELECT pg_temp.expect_error('no s''esborra una categoria amb productes', '23503',
  $$DELETE FROM categories WHERE slug = 'sillas'$$);

-- Productes -----------------------------------------------------------------
SELECT pg_temp.expect_error('no s''admeten preus negatius', '23514',
  $$UPDATE products SET daily_price = -1 WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('la moneda és un codi ISO de tres lletres', '23514',
  $$UPDATE products SET currency = 'eu' WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('un producte necessita una categoria existent', '23503',
  $$INSERT INTO products (seller_id, category_id, name, daily_price)
    VALUES ('a0000000-0000-4000-8000-000000000001', gen_random_uuid(), 'Orfe', 1)$$);

SELECT pg_temp.expect_error('un producte necessita un venedor existent', '23503',
  $$INSERT INTO products (seller_id, category_id, name, daily_price)
    VALUES (gen_random_uuid(), 'c0000000-0000-4000-8000-000000000002', 'Orfe', 1)$$);

SELECT pg_temp.expect_error('no s''esborra un venedor amb productes', '23503',
  $$DELETE FROM sellers WHERE id = 'a0000000-0000-4000-8000-000000000001'$$);

ROLLBACK;
\echo 'Totes les proves han passat.'
