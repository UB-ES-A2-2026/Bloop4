-- Consultes d'exemple sobre les dades de db/seeds.
-- Executar amb:  ./db/psql.sh < db/queries/examples.sql
\pset null '—'

-- ===========================================================================
-- 1. Catàleg complet (el que retorna GET /api/products sense filtre)
-- ===========================================================================
\echo '\n== 1. Catálogo completo =='
SELECT p.name, p.daily_price, p.currency, c.name AS category, pc.name AS parent_category,
       s.legal_name AS seller, s.city
FROM products p
JOIN categories c       ON c.id = p.category_id
LEFT JOIN categories pc ON pc.id = c.parent_id
JOIN sellers s          ON s.id = p.seller_id
ORDER BY p.name, p.id;

-- ===========================================================================
-- 2. Filtre per categoria pare: inclou els productes de les seves subcategories
--    (el que fa GET /api/products?categoryId=<Sonido>)
-- ===========================================================================
\echo '\n== 2. Productos de "Sonido" y sus subcategorías =='
WITH RECURSIVE selected (id) AS (
  SELECT id FROM categories WHERE slug = 'sonido'
  UNION
  SELECT c.id FROM categories c JOIN selected s ON c.parent_id = s.id
)
SELECT p.name, c.name AS category, p.daily_price
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.category_id IN (SELECT id FROM selected)
ORDER BY p.name;

-- ===========================================================================
-- 3. Arbre de categories amb recompte de productes (GET /api/categories)
-- ===========================================================================
\echo '\n== 3. Categorías con número de productos =='
SELECT coalesce(pc.name || ' › ', '') || c.name AS category,
       count(p.id) AS product_count
FROM categories c
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN products p    ON p.category_id = c.id
GROUP BY c.id, pc.name, pc.sort_order
ORDER BY coalesce(pc.sort_order, c.sort_order), c.parent_id NULLS FIRST, c.sort_order;
