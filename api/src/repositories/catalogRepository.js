/**
 * Accés a les dades del catàleg. És l'única capa que coneix l'esquema SQL;
 * retorna objectes que ja tenen la forma del contracte JSON de l'API.
 */

// $1: categories demanades (o NULL = totes). Inclou les seves descendents, així que
// demanar una categoria pare retorna els productes de totes les seves subcategories.
const SELECTED_CATEGORIES = `
  WITH RECURSIVE selected (id) AS (
    SELECT id FROM categories WHERE id = ANY($1::uuid[])
    UNION
    SELECT c.id FROM categories c JOIN selected s ON c.parent_id = s.id
  )`;

const IN_SELECTED_CATEGORIES = `($1::uuid[] IS NULL OR p.category_id IN (SELECT id FROM selected))`;

// $2: text de cerca tal com l'escriu l'usuari (o NULL = sense cerca); search_normalize() en
// treu els accents i les majúscules.
// El document inclou el nom del producte (pes A) i els de la seva categoria i categoria
// arrel (pes B). Coincideix per full-text o, per tolerar errors tipogràfics i paraules a
// mig escriure, per similitud de trigrames sobre el nom (operador <% de pg_trgm).
const SEARCH = `
  search (query, text) AS (
    SELECT plainto_tsquery('spanish', search_normalize($2::text)), search_normalize($2::text)
  )`;

const SEARCH_DOCUMENT = `
  CROSS JOIN search sq
  CROSS JOIN LATERAL (
    SELECT setweight(to_tsvector('spanish', search_normalize(p.name)), 'A')
        || setweight(to_tsvector('spanish', search_normalize(c.name || ' ' || coalesce(pc.name, ''))), 'B')
        AS document
  ) d`;

const MATCHES_SEARCH = `($2::text IS NULL OR d.document @@ sq.query OR sq.text <% search_normalize(p.name))`;

const PRODUCTS_FROM = `
  FROM products p
  JOIN categories c       ON c.id = p.category_id
  LEFT JOIN categories pc ON pc.id = c.parent_id
  ${SEARCH_DOCUMENT}`;

const PRODUCTS_WHERE = `WHERE ${IN_SELECTED_CATEGORIES} AND ${MATCHES_SEARCH}`;

const LIST_PRODUCTS = `
  ${SELECTED_CATEGORIES}, ${SEARCH}
  SELECT p.id, p.name, p.daily_price, p.currency,
         c.id  AS category_id, c.name  AS category_name, c.slug  AS category_slug,
         pc.id AS parent_id,   pc.name AS parent_name,   pc.slug AS parent_slug,
         s.id  AS seller_id,   s.legal_name AS seller_legal_name, s.city AS seller_city
  ${PRODUCTS_FROM}
  JOIN sellers s ON s.id = p.seller_id
  ${PRODUCTS_WHERE}
  ORDER BY CASE WHEN $2::text IS NULL THEN 0
                ELSE ts_rank(d.document, sq.query) + word_similarity(sq.text, search_normalize(p.name))
           END DESC,
           p.name, p.id
  LIMIT $3 OFFSET $4`;

const COUNT_PRODUCTS = `
  ${SELECTED_CATEGORIES}, ${SEARCH}
  SELECT count(*)::int AS total
  ${PRODUCTS_FROM}
  ${PRODUCTS_WHERE}`;

// productCount només compta els productes assignats directament a la categoria.
const LIST_CATEGORIES = `
  SELECT c.id, c.parent_id, c.name, c.slug, c.sort_order,
         count(p.id)::int AS product_count
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.id
  GROUP BY c.id
  ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name`;

function toCategoryRef(id, name, slug) {
  return id ? { id, name, slug } : null;
}

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    // NUMERIC arriba de pg com a string: es manté així per no perdre precisió.
    dailyPrice: row.daily_price,
    currency: row.currency,
    category: toCategoryRef(row.category_id, row.category_name, row.category_slug),
    parentCategory: toCategoryRef(row.parent_id, row.parent_name, row.parent_slug),
    seller: {
      id: row.seller_id,
      legalName: row.seller_legal_name,
      city: row.seller_city,
    },
  };
}

export function createCatalogRepository(pool) {
  return {
    async listCategories() {
      const { rows } = await pool.query(LIST_CATEGORIES);
      return rows.map((r) => ({
        id: r.id,
        parentId: r.parent_id,
        name: r.name,
        slug: r.slug,
        sortOrder: r.sort_order,
        productCount: r.product_count,
      }));
    },

    /** @param {{ categoryIds: string[] | null, q: string | null, limit: number, offset: number }} params */
    async listProducts({ categoryIds, q = null, limit, offset }) {
      // Pàgina i recompte en la mateixa instantània (REPEATABLE READ): si algú
      // afegeix un producte entre les dues consultes, totalItems no es desquadra.
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const page = await client.query(LIST_PRODUCTS, [categoryIds, q, limit, offset]);
        const count = await client.query(COUNT_PRODUCTS, [categoryIds, q]);
        await client.query('COMMIT');
        return { items: page.rows.map(toProduct), totalItems: count.rows[0].total };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    async ping() {
      await pool.query('SELECT 1');
    },
  };
}
