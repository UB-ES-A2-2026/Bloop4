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

-- Cerca (002) ---------------------------------------------------------------
SELECT pg_temp.assert('les extensions unaccent i pg_trgm estan instal·lades',
  (SELECT count(*) FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm')) = 2);

SELECT pg_temp.assert('existeixen els índexs de full-text i de trigrames sobre el nom',
  (SELECT count(*) FROM pg_indexes
   WHERE tablename = 'products' AND indexname IN ('products_name_fts_idx', 'products_name_trgm_idx')) = 2);

SELECT pg_temp.assert('search_normalize treu accents i majúscules',
  search_normalize('MICRÓFONO Inalámbrico') = 'microfono inalambrico');

-- Fitxa de producte (003) ---------------------------------------------------
SELECT pg_temp.assert('tots els productes d''exemple tenen descripció i hi ha 5 imatges',
  (SELECT count(*) FROM products WHERE description IS NOT NULL) = 15
  AND (SELECT count(*) FROM product_images) = 5);

SELECT pg_temp.expect_error('no s''admeten fiances negatives', '23514',
  $$UPDATE products SET deposit_amount = -1 WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('les especificacions han de ser un objecte JSON', '23514',
  $$UPDATE products SET specs = '["1300 W"]' WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('la descripció no pot ser buida', '23514',
  $$UPDATE products SET description = '  ' WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('la ruta d''una imatge ha de ser absoluta i sense caràcters estranys', '23514',
  $$INSERT INTO product_images (product_id, path, alt_text)
    VALUES ('d0000000-0000-4000-8000-000000000002', 'http://x/y.jpg', 'x')$$);

SELECT pg_temp.expect_error('dues imatges d''un producte no comparteixen posició', '23505',
  $$INSERT INTO product_images (product_id, path, alt_text, sort_order)
    VALUES ('d0000000-0000-4000-8000-000000000014', '/images/x.svg', 'x', 0)$$);

-- Usuaris i sessions (004) --------------------------------------------------
SELECT pg_temp.assert('els seeds tenen un usuari de cada rol i els 2 venedors enllaçats',
  (SELECT count(DISTINCT role) FROM user_roles) = 4
  AND (SELECT count(*) FROM sellers WHERE user_id IS NOT NULL) = 2
  AND NOT EXISTS (SELECT 1 FROM users WHERE email NOT LIKE '%@example.com'));

SELECT pg_temp.expect_error('el correu es guarda en minúscules', '23514',
  $$INSERT INTO users (email, password_hash, full_name) VALUES ('Nou@example.com', 'scrypt$x', 'Nou')$$);

SELECT pg_temp.expect_error('el correu és únic', '23505',
  $$INSERT INTO users (email, password_hash, full_name) VALUES ('cliente@example.com', 'scrypt$x', 'Bis')$$);

SELECT pg_temp.expect_error('un compte actiu ha d''haver verificat el correu', '23514',
  $$INSERT INTO users (email, password_hash, full_name, status) VALUES ('nou@example.com', 'scrypt$x', 'Nou', 'active')$$);

SELECT pg_temp.expect_error('la contrasenya només es guarda com a hash scrypt', '23514',
  $$INSERT INTO users (email, password_hash, full_name) VALUES ('nou@example.com', 'contrasenya', 'Nou')$$);

SELECT pg_temp.expect_error('un rol ha d''existir', '23503',
  $$INSERT INTO user_roles (user_id, role) VALUES ('b0000000-0000-4000-8000-000000000001', 'superadmin')$$);

SELECT pg_temp.expect_error('un usuari només gestiona un venedor', '23505',
  $$UPDATE sellers SET user_id = 'b0000000-0000-4000-8000-000000000002' WHERE id = 'a0000000-0000-4000-8000-000000000002'$$);

SELECT pg_temp.expect_error('a la sessió només hi va el hash SHA-256 del token', '23514',
  $$INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES ('token-en-clar', 'b0000000-0000-4000-8000-000000000001', now() + interval '1 day')$$);

-- Inventari del venedor (005) ----------------------------------------------
SELECT pg_temp.assert('els seeds tenen 336 unitats (1 en manteniment), 2 magatzems i tots els productes publicats',
  (SELECT count(*) FROM product_units) = 336
  AND (SELECT count(*) FROM product_units WHERE status = 'maintenance') = 1
  AND (SELECT count(*) FROM warehouses) = 2
  AND NOT EXISTS (SELECT 1 FROM products WHERE status <> 'published'));

SELECT pg_temp.expect_error('l''estat d''un producte és draft o published', '23514',
  $$UPDATE products SET status = 'hidden' WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('el pes ha de ser positiu', '23514',
  $$UPDATE products SET weight_kg = 0 WHERE id = 'd0000000-0000-4000-8000-000000000001'$$);

SELECT pg_temp.expect_error('una unitat no pot anar al magatzem d''un altre venedor', '23503',
  $$INSERT INTO product_units (product_id, seller_id, warehouse_id)
    VALUES ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
            'e0000000-0000-4000-8000-000000000002')$$);

SELECT pg_temp.expect_error('una unitat no pot ser d''un producte d''un altre venedor', '23503',
  $$INSERT INTO product_units (product_id, seller_id, warehouse_id)
    VALUES ('d0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001',
            'e0000000-0000-4000-8000-000000000001')$$);

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
