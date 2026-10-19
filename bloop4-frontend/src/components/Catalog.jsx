import { useMemo, useState } from 'react';
import CategoryFilter from './CategoryFilter';
import ProductCard from './ProductCard';
import ProductGridSkeleton from './ProductGridSkeleton';
import StatusPanel from './StatusPanel';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { buildCategoryTree, getActiveFilters, toggleCategories } from '../lib/catalog';

function ProductResults({ products, hasFilters, onClear }) {
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
    // Sense filtres, el catàleg és buit; amb filtres, la combinació no té resultats.
    return hasFilters ? (
      <StatusPanel
        title="No hay productos en estas categorías"
        text="Prueba a quitar algún filtro."
        actionLabel="Quitar filtros"
        onAction={onClear}
      />
    ) : (
      <StatusPanel title="Todavía no hay productos en el catálogo" />
    );
  }

  return (
    <>
      <ul className="product-grid" aria-label="Productos">
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
  const [selectedIds, setSelectedIds] = useState([]);
  const categories = useCategories();
  const products = useProducts(selectedIds);

  const tree = useMemo(() => buildCategoryTree(categories.categories), [categories.categories]);
  const activeFilters = useMemo(() => getActiveFilters(tree, selectedIds), [tree, selectedIds]);

  const toggle = (ids) => setSelectedIds((current) => toggleCategories(current, ids));
  const clear = () => setSelectedIds([]);

  const title =
    activeFilters.length === 0
      ? 'Todo el catálogo'
      : activeFilters.length === 1
        ? activeFilters[0].label
        : `${activeFilters.length} categorías`;
  const countLabel =
    products.status === 'loading'
      ? 'Cargando…'
      : `${products.totalItems} ${products.totalItems === 1 ? 'producto' : 'productos'}`;

  return (
    <section id="catalogo" className="catalog" aria-labelledby="catalog-title">
      <header className="catalog__header">
        <div className="eyebrow">Alquiler de material para eventos</div>
        <h1 id="catalog-title" className="catalog__title">{title}</h1>
      </header>

      <div className="catalog__body">
        <CategoryFilter
          status={categories.status}
          tree={tree}
          selectedIds={selectedIds}
          onToggle={toggle}
          onClear={clear}
          onRetry={categories.retry}
        />

        <div className="catalog__results">
          <div className="results-bar">
            <p className="results-bar__count" role="status">{countLabel}</p>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="chip"
                onClick={() => toggle(filter.ids)}
                aria-label={`Quitar filtro ${filter.label}`}
              >
                {filter.label}
                <span className="chip__x" aria-hidden="true">✕</span>
              </button>
            ))}
          </div>

          <ProductResults products={products} hasFilters={selectedIds.length > 0} onClear={clear} />
        </div>
      </div>
    </section>
  );
}
