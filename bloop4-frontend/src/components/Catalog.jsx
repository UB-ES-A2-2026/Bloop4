import { useMemo, useState } from 'react';
import CategoryFilter from './CategoryFilter';
import ProductCard from './ProductCard';
import ProductGridSkeleton from './ProductGridSkeleton';
import SearchBar, { SEARCH_MIN_LENGTH } from './SearchBar';
import StatusPanel from './StatusPanel';
import { useCategories } from '../hooks/useCategories';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useProducts } from '../hooks/useProducts';
import { buildCategoryTree, getActiveFilters, toggleCategories } from '../lib/catalog';

export const SEARCH_DEBOUNCE_MS = 300;

/** Text que s'envia a l'API: retallat i només a partir de 2 caràcters. */
function toQuery(text) {
  const trimmed = text.trim();
  return trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : '';
}

function ProductResults({ products, query, hasFilters, onClear }) {
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
    // Amb cerca o filtres, la combinació no té resultats; sense, el catàleg és buit.
    if (query) {
      return (
        <StatusPanel
          title={`No hay productos que coincidan con «${query}»`}
          text="Prueba con otra palabra o quita los filtros."
          actionLabel="Quitar búsqueda y filtros"
          onAction={onClear}
        />
      );
    }
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
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  // Esborrar el camp treu la cerca a l'acte, sense esperar el debounce.
  const query = searchText.trim() === '' ? '' : toQuery(debouncedSearch);

  const categories = useCategories();
  const products = useProducts(selectedIds, query);

  const tree = useMemo(() => buildCategoryTree(categories.categories), [categories.categories]);
  const activeFilters = useMemo(() => getActiveFilters(tree, selectedIds), [tree, selectedIds]);

  const toggle = (ids) => setSelectedIds((current) => toggleCategories(current, ids));
  const clear = () => setSelectedIds([]);
  const clearSearch = () => setSearchText('');
  const clearAll = () => {
    clear();
    clearSearch();
  };

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
          <SearchBar value={searchText} onChange={setSearchText} onClear={clearSearch} />

          <div className="results-bar">
            <p className="results-bar__count" role="status">{countLabel}</p>
            {query && (
              <button
                type="button"
                className="chip chip--search"
                onClick={clearSearch}
                aria-label={`Quitar búsqueda «${query}»`}
              >
                «{query}»
                <span className="chip__x" aria-hidden="true">✕</span>
              </button>
            )}
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

          <ProductResults
            products={products}
            query={query}
            hasFilters={selectedIds.length > 0}
            onClear={query ? clearAll : clear}
          />
        </div>
      </div>
    </section>
  );
}
