/**
 * Productes del venedor (US-10): esborranys, publicació, unitats i fotos. Les rutes ja han
 * comprovat que el producte és del venedor; aquí només hi ha SQL.
 */

// Camps editables: nom al JSON → columna.
const COLUMNS = {
  name: 'name',
  categoryId: 'category_id',
  description: 'description',
  dailyPrice: 'daily_price',
  depositAmount: 'deposit_amount',
  insurance: 'insurance',
  specs: 'specs',
  weightKg: 'weight_kg',
  lengthCm: 'length_cm',
  widthCm: 'width_cm',
  heightCm: 'height_cm',
};

const PRODUCT = `
  SELECT p.id, p.name, p.status, p.daily_price, p.currency, p.description, p.deposit_amount,
         p.insurance, p.specs, p.weight_kg, p.length_cm, p.width_cm, p.height_cm,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
         (SELECT count(*)::int FROM product_units u WHERE u.product_id = p.id AND u.status <> 'retired') AS units,
         coalesce(
           (SELECT json_agg(json_build_object('id', i.id, 'path', i.path, 'altText', i.alt_text) ORDER BY i.sort_order)
            FROM product_images i WHERE i.product_id = p.id),
           '[]') AS images
  FROM products p
  JOIN categories c ON c.id = p.category_id`;

function toSellerProduct(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    dailyPrice: row.daily_price,
    depositAmount: row.deposit_amount,
    currency: row.currency,
    description: row.description,
    insurance: row.insurance,
    specs: row.specs,
    weightKg: row.weight_kg,
    lengthCm: row.length_cm,
    widthCm: row.width_cm,
    heightCm: row.height_cm,
    units: row.units,
    images: row.images,
  };
}

async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Magatzem on van les unitats noves: el primer del venedor (si no en té, se'n crea un). */
async function defaultWarehouse(client, sellerId) {
  const existing = await client.query('SELECT id FROM warehouses WHERE seller_id = $1 ORDER BY name LIMIT 1', [sellerId]);
  if (existing.rows.length) return existing.rows[0].id;
  const { rows } = await client.query(
    `INSERT INTO warehouses (seller_id, name, city)
     SELECT id, 'Almacén principal', city FROM sellers WHERE id = $1
     RETURNING id`,
    [sellerId],
  );
  return rows[0].id;
}

/** Deixa `units` unitats actives: n'afegeix de noves o retira les disponibles més recents. */
async function setUnits(client, sellerId, productId, units) {
  const { rows } = await client.query(
    "SELECT count(*)::int AS active FROM product_units WHERE product_id = $1 AND status <> 'retired'",
    [productId],
  );
  const diff = units - rows[0].active;
  if (diff > 0) {
    const warehouseId = await defaultWarehouse(client, sellerId);
    await client.query(
      `INSERT INTO product_units (product_id, seller_id, warehouse_id)
       SELECT $1, $2, $3 FROM generate_series(1, $4)`,
      [productId, sellerId, warehouseId, diff],
    );
  } else if (diff < 0) {
    await client.query(
      `UPDATE product_units SET status = 'retired'
       WHERE id IN (SELECT id FROM product_units
                    WHERE product_id = $1 AND status = 'available'
                    ORDER BY created_at DESC, id LIMIT $2)`,
      [productId, -diff],
    );
  }
}

/** Columnes i valors dels camps editables presents a `fields`. */
function columnsAndValues(fields) {
  const keys = Object.keys(fields).filter((key) => key in COLUMNS);
  return {
    columns: keys.map((key) => COLUMNS[key]),
    values: keys.map((key) => (key === 'specs' ? JSON.stringify(fields[key]) : fields[key])),
  };
}

export function createSellerRepository(pool) {
  return {
    async getSeller(sellerId) {
      const { rows } = await pool.query('SELECT id, legal_name, city, verified FROM sellers WHERE id = $1', [sellerId]);
      return rows[0] ? { id: rows[0].id, legalName: rows[0].legal_name, city: rows[0].city, verified: rows[0].verified } : null;
    },

    async categoryExists(categoryId) {
      const { rows } = await pool.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
      return rows.length > 0;
    },

    /** Venedor propietari d'un producte, o null si el producte no existeix. */
    async getProductSellerId(productId) {
      const { rows } = await pool.query('SELECT seller_id FROM products WHERE id = $1', [productId]);
      return rows[0]?.seller_id ?? null;
    },

    async listProducts(sellerId) {
      const { rows } = await pool.query(`${PRODUCT} WHERE p.seller_id = $1 ORDER BY p.status, p.name, p.id`, [sellerId]);
      return rows.map(toSellerProduct);
    },

    async getProduct(productId) {
      const { rows } = await pool.query(`${PRODUCT} WHERE p.id = $1`, [productId]);
      return rows[0] ? toSellerProduct(rows[0]) : null;
    },

    /** Crea un esborrany amb les seves unitats. */
    async createProduct(sellerId, { units = 0, ...fields }) {
      const id = await inTransaction(pool, async (client) => {
        const { columns, values } = columnsAndValues(fields);
        const { rows } = await client.query(
          `INSERT INTO products (seller_id, ${columns.join(', ')})
           VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
           RETURNING id`,
          [sellerId, ...values],
        );
        await setUnits(client, sellerId, rows[0].id, units);
        return rows[0].id;
      });
      return this.getProduct(id);
    },

    async updateProduct(sellerId, productId, { units, ...fields }) {
      await inTransaction(pool, async (client) => {
        const { columns, values } = columnsAndValues(fields);
        if (columns.length) {
          const set = columns.map((column, i) => `${column} = $${i + 2}`).join(', ');
          await client.query(`UPDATE products SET ${set} WHERE id = $1`, [productId, ...values]);
        }
        if (units !== undefined) await setUnits(client, sellerId, productId, units);
      });
      return this.getProduct(productId);
    },

    async publishProduct(productId) {
      await pool.query("UPDATE products SET status = 'published' WHERE id = $1", [productId]);
      return this.getProduct(productId);
    },

    /**
     * Afegeix una foto al final. Bloqueja el producte perquè dues pujades simultànies no
     * superin el màxim. @returns null si ja en té `max`.
     */
    async addImage(productId, { path, altText }, max) {
      return inTransaction(pool, async (client) => {
        await client.query('SELECT 1 FROM products WHERE id = $1 FOR UPDATE', [productId]);
        const { rows } = await client.query(
          'SELECT count(*)::int AS n, coalesce(max(sort_order) + 1, 0) AS next FROM product_images WHERE product_id = $1',
          [productId],
        );
        if (rows[0].n >= max) return null;
        const inserted = await client.query(
          `INSERT INTO product_images (product_id, path, alt_text, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id, path, alt_text`,
          [productId, path, altText, rows[0].next],
        );
        const image = inserted.rows[0];
        return { id: image.id, path: image.path, altText: image.alt_text };
      });
    },

    /** @returns la ruta de la foto esborrada, o null si no era d'aquest producte. */
    async deleteImage(productId, imageId) {
      const { rows } = await pool.query(
        'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING path',
        [imageId, productId],
      );
      return rows[0]?.path ?? null;
    },
  };
}
