import { Link, useLocation } from 'react-router-dom';
import ProductVisual from './ProductVisual';
import { formatPrice } from '../lib/format';

export default function ProductCard({ product }) {
  const location = useLocation();

  // La fitxa rep la cerca del catàleg per poder-hi tornar amb els mateixos filtres. Dins de
  // l'enllaç hi va un <div> (no un <article>) perquè el nom accessible de l'enllaç sigui el text
  // de la targeta: Chromium no el calcula a través d'un <article>.
  return (
    <Link
      className="card-link"
      to={`/productos/${product.id}`}
      state={{ catalogSearch: location.search, categoryId: product.category.id }}
    >
      <div className="card">
        <ProductVisual product={product} />
        <div className="card__body">
          <h3 className="card__name">{product.name}</h3>
          <p className="card__vendor">
            {product.seller.legalName} · {product.seller.city}
          </p>
          <p className="card__price">
            <strong>{formatPrice(product.dailyPrice, product.currency)}</strong> /día
          </p>
        </div>
      </div>
    </Link>
  );
}
