import { getProductVisuals } from '../theme/visuals';

const formatters = new Map();
function formatPrice(amount, currency) {
  // L'API envia l'import com a string decimal ("3.50") per no perdre precisió.
  const value = Number(amount);
  const decimals = Number.isInteger(value) ? 0 : 2; // 45 € · 3,50 €
  const key = `${currency}:${decimals}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('es-ES', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    );
  }
  return formatters.get(key).format(value);
}

export default function ProductCard({ product }) {
  const { background, shapeColor, shape, glyph } = getProductVisuals(product);

  return (
    <article className="card">
      <div className="card__media" style={{ background }} aria-hidden="true">
        <div
          className="card__shape"
          style={{
            width: shape.width,
            top: shape.top,
            left: shape.left,
            borderRadius: shape.borderRadius,
            transform: `rotate(${shape.rotate})`,
            background: shapeColor,
          }}
        />
        <div className="card__category">{product.category.name}</div>
        <div className="card__glyph">{glyph}</div>
      </div>
      <div className="card__body">
        <h3 className="card__name">{product.name}</h3>
        <p className="card__vendor">
          {product.seller.legalName} · {product.seller.city}
        </p>
        <p className="card__price">
          <strong>{formatPrice(product.dailyPrice, product.currency)}</strong> /día
        </p>
      </div>
    </article>
  );
}
