import { getProductVisuals } from '../theme/visuals';

/** Il·lustració per defecte d'un producte: color de la categoria arrel, forma i glif. */
export default function ProductVisual({ product, className = 'card__media' }) {
  const { background, shapeColor, shape, glyph } = getProductVisuals(product);

  return (
    <div className={className} style={{ background }} aria-hidden="true">
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
  );
}
