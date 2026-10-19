import { getSelectionState, selectableIds } from '../lib/catalog';

const CHECK_MARK = { all: '✓', some: '–', none: '' };
const ARIA_CHECKED = { all: 'true', some: 'mixed', none: 'false' };

function FilterOption({ category, selectedIds, onToggle, isParent = false }) {
  const state = getSelectionState(category, selectedIds);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ARIA_CHECKED[state]}
      className={`filter__option${isParent ? ' filter__option--parent' : ''}`}
      onClick={() => onToggle(selectableIds(category))}
    >
      <span className="filter__box" aria-hidden="true">{CHECK_MARK[state]}</span>
      <span className="filter__label">{category.name}</span>
      <span className="filter__count" aria-label={`${category.count} productos`}>{category.count}</span>
    </button>
  );
}

function FilterBody({ status, tree, selectedIds, onToggle, onRetry }) {
  if (status === 'loading') {
    return (
      <div className="filter__group" aria-busy="true" aria-label="Cargando categorías">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton skeleton--option" />)}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="filter__error" role="alert">
        <p>No se pudieron cargar las categorías.</p>
        <button type="button" className="btn-outline" onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  return (
    <ul className="filter__group">
      {tree.map((parent) => (
        <li key={parent.id}>
          <FilterOption isParent category={parent} selectedIds={selectedIds} onToggle={onToggle} />
          {parent.children.length > 0 && (
            <ul className="filter__children">
              {parent.children.map((child) => (
                <li key={child.id}>
                  <FilterOption category={child} selectedIds={selectedIds} onToggle={onToggle} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Filtre de dos nivells. Marcar un pare activa totes les seves subcategories;
 * si només n'hi ha algunes d'actives, el pare apareix com a "mixt".
 */
export default function CategoryFilter({ status, tree, selectedIds, onToggle, onClear, onRetry }) {
  return (
    <aside className="filter" aria-labelledby="filter-title">
      <h2 id="filter-title" className="eyebrow">Categoría</h2>
      <FilterBody status={status} tree={tree} selectedIds={selectedIds} onToggle={onToggle} onRetry={onRetry} />
      {selectedIds.length > 0 && (
        <button type="button" className="btn-outline" onClick={onClear}>
          Quitar filtros
        </button>
      )}
    </aside>
  );
}
