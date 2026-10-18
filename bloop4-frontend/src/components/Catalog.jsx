import ProductCard from './ProductCard';
import ProductGridSkeleton from './ProductGridSkeleton';
import StatusPanel from './StatusPanel';
import { useProducts } from '../hooks/useProducts';

// Encara sense filtre: el filtre per categories (US-02) s'afegeix en el seu propi PR.
const NO_FILTER = [];

function ProductResults({ products }) {
  const { items, status, error, hasMore, loadMore, retry } = products;

  if (status === 'loading') return <ProductGridSkeleton />;
  if (status === 'error' && items.length === 0) {
    return (
      <StatusPanel
        role="alert"
        title="No se pudo cargar el catálogo"
        text={error?.message}
        actionLabel="Reintentar"
        onAction={retry}
      />
    );
  }
  if (items.length === 0) {
    return <StatusPanel title="Todavía no hay productos en el catálogo" />;
  }

  return (
    <>
      <ul className="product-grid">
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      {status === 'error' && (
        <p className="load-more__error" role="alert">
          No se pudo cargar la página siguiente. <button type="button" className="link-button" onClick={retry}>Reintentar</button>
        </p>
      )}
      {hasMore && status !== 'error' && (
        <button type="button" className="btn-outline load-more" onClick={loadMore} disabled={status === 'loadingMore'}>
          {status === 'loadingMore' ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </>
  );
}

export default function Catalog() {
  const products = useProducts(NO_FILTER);

  const countLabel =
    products.status === 'loading'
      ? 'Cargando…'
      : `${products.totalItems} ${products.totalItems === 1 ? 'producto' : 'productos'}`;

  return (
    <section id="catalogo" className="catalog" aria-labelledby="catalog-title">
      <header className="catalog__header">
        <div className="eyebrow">Alquiler de material para eventos</div>
        <h1 id="catalog-title" className="catalog__title">Todo el catálogo</h1>
      </header>

      <div className="catalog__body">
        <div className="catalog__results">
          <div className="results-bar">
            <p className="results-bar__count" role="status">{countLabel}</p>
          </div>

          <ProductResults products={products} />
        </div>
      </div>
    </section>
  );
}
