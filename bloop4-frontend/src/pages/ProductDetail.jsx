import { Link, useLocation, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductGallery from '../components/ProductGallery';
import ProductGridSkeleton from '../components/ProductGridSkeleton';
import StatusPanel from '../components/StatusPanel';
import { useProduct } from '../hooks/useProduct';
import { useProducts } from '../hooks/useProducts';
import { formatPrice } from '../lib/format';

/** Especificacions amb valor; les buides no es mostren. */
function visibleSpecs(specs) {
  return Object.entries(specs ?? {}).filter(([, value]) => value !== null && String(value).trim() !== '');
}

/** Productes de la mateixa categoria (o del catàleg, si no se sap) per al 404. */
function RelatedProducts({ categoryId }) {
  const { items, status } = useProducts(categoryId ? [categoryId] : []);
  if (status === 'loading') return <ProductGridSkeleton count={4} />;
  if (items.length === 0) return null;
  return (
    <section className="detail__related" aria-labelledby="related-title">
      <h2 id="related-title" className="detail__subtitle">También te puede interesar</h2>
      <ul className="product-grid" aria-label="Productos relacionados">
        {items.slice(0, 4).map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductInfo({ product }) {
  const specs = visibleSpecs(product.specs);
  const deposit = Number(product.depositAmount) === 0 ? 'Sin fianza' : formatPrice(product.depositAmount, product.currency);

  return (
    <article className="detail">
      <ProductGallery product={product} />

      <div className="detail__info">
        <div className="eyebrow">{product.parentCategory ? `${product.parentCategory.name} · ` : ''}{product.category.name}</div>
        <h1 className="detail__title">{product.name}</h1>
        <p className="card__vendor">
          {product.seller.legalName} · {product.seller.city}
        </p>

        <dl className="detail__prices">
          <div>
            <dt>Precio por día</dt>
            <dd className="detail__price">{formatPrice(product.dailyPrice, product.currency)}</dd>
          </div>
          <div>
            <dt>Fianza</dt>
            <dd>{deposit}</dd>
          </div>
          <div>
            <dt>Seguro</dt>
            <dd>{product.insurance ?? 'Sin seguro'}</dd>
          </div>
        </dl>

        {product.description && <p className="detail__description">{product.description}</p>}

        {specs.length > 0 && (
          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="detail__subtitle">Especificaciones</h2>
            <table className="specs">
              <tbody>
                {specs.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </article>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { product, status, error, retry } = useProduct(id);
  // Tornar al catàleg amb la mateixa cerca i els mateixos filtres que hi havia.
  const backTo = `/${location.state?.catalogSearch ?? ''}`;

  return (
    <section className="detail-page">
      <Link className="detail__back" to={backTo}>
        ← Volver al catálogo
      </Link>

      {status === 'loading' && <div className="skeleton detail__skeleton" aria-label="Cargando producto" aria-busy="true" />}
      {status === 'error' && (
        <StatusPanel
          role="alert"
          title="No se pudo cargar el producto"
          text={error?.message}
          actionLabel="Reintentar"
          onAction={retry}
        />
      )}
      {status === 'notFound' && (
        <>
          <div className="empty-state" role="status">
            <h2 className="empty-state__title">Producto no disponible</h2>
            <p className="empty-state__text">Puede que se haya retirado del catálogo.</p>
            <Link className="btn-primary" to="/">Ver el catálogo</Link>
          </div>
          <RelatedProducts categoryId={location.state?.categoryId} />
        </>
      )}
      {status === 'success' && <ProductInfo product={product} />}
    </section>
  );
}
