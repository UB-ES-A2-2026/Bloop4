/**
 * Lògica pura del filtre de categories (sense React), testejable per separat.
 * Treballa amb la forma que retorna GET /api/categories.
 */

/**
 * Arbre de dos nivells. `count` d'un pare = els seus productes directes més els
 * de les seves subcategories (l'API dona el recompte directe de cada categoria).
 */
export function buildCategoryTree(categories) {
  const bySortOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es');

  return categories
    .filter((c) => c.parentId === null)
    .sort(bySortOrder)
    .map((parent) => {
      const children = categories
        .filter((c) => c.parentId === parent.id)
        .sort(bySortOrder)
        .map((child) => ({ ...child, count: child.productCount }));
      return {
        ...parent,
        children,
        count: parent.productCount + children.reduce((sum, c) => sum + c.count, 0),
      };
    });
}

/** Ids que representa marcar una categoria: ella mateixa si és fulla; si no, les seves filles. */
export function selectableIds(category) {
  return category.children?.length ? category.children.map((c) => c.id) : [category.id];
}

/**
 * Activa o desactiva un grup de categories: si ja estaven totes actives
 * es treuen; si no, s'afegeixen les que faltin.
 */
export function toggleCategories(selectedIds, ids) {
  const allSelected = ids.every((id) => selectedIds.includes(id));
  return allSelected
    ? selectedIds.filter((id) => !ids.includes(id))
    : [...selectedIds, ...ids.filter((id) => !selectedIds.includes(id))];
}

/** 'all' | 'some' | 'none' segons quantes de les seves categories estiguin actives. */
export function getSelectionState(category, selectedIds) {
  const ids = selectableIds(category);
  const active = ids.filter((id) => selectedIds.includes(id)).length;
  if (active === 0) return 'none';
  return active === ids.length ? 'all' : 'some';
}

/**
 * Xips dels filtres actius. Si un pare té totes les seves subcategories
 * actives, es mostra un únic xip amb el nom del pare.
 */
export function getActiveFilters(tree, selectedIds) {
  return tree.flatMap((parent) => {
    if (getSelectionState(parent, selectedIds) === 'all') {
      return [{ key: parent.id, label: parent.name, ids: selectableIds(parent) }];
    }
    return parent.children
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => ({ key: c.id, label: c.name, ids: [c.id] }));
  });
}
