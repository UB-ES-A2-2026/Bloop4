import { useEffect, useReducer } from 'react';
import { fetchProducts } from '../api/catalogApi';

export const PAGE_SIZE = 24;

/**
 * status: loading (pàgina 1) | loadingMore | success | error
 * `request` és el que s'ha de demanar; canviar-lo (filtre, pàgina o reintent)
 * dispara l'efecte de càrrega.
 */
function initialState(filterKey) {
  return {
    request: { filterKey, page: 1, attempt: 0 },
    items: [],
    totalItems: 0,
    status: 'loading',
    error: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'filterChanged':
      return initialState(action.filterKey);
    case 'loadMore':
      return { ...state, status: 'loadingMore', error: null, request: { ...state.request, page: state.request.page + 1, attempt: 0 } };
    case 'retry':
      return {
        ...state,
        status: state.request.page === 1 ? 'loading' : 'loadingMore',
        error: null,
        request: { ...state.request, attempt: state.request.attempt + 1 },
      };
    case 'loaded':
      if (action.request !== state.request) return state; // resposta d'una petició ja superada
      return {
        ...state,
        items: action.request.page === 1 ? action.data : [...state.items, ...action.data],
        totalItems: action.totalItems,
        status: 'success',
      };
    case 'failed':
      if (action.request !== state.request) return state;
      return { ...state, status: 'error', error: action.error };
    default:
      throw new Error(`Acción desconocida: ${action.type}`);
  }
}

/**
 * Productes filtrats per categoria, demanats al servidor pàgina a pàgina.
 * Canviar el filtre reinicia la llista; `loadMore` afegeix la pàgina següent.
 * Cada petició s'avorta si canvia abans de respondre i, a més, el reducer
 * descarta qualsevol resposta que no correspongui a la petició vigent.
 */
export function useProducts(categoryIds) {
  const filterKey = [...categoryIds].sort().join(',');
  const [state, dispatch] = useReducer(reducer, filterKey, initialState);

  // Filtre nou → reinici atòmic (llista, estat i pàgina) durant el render.
  if (state.request.filterKey !== filterKey) {
    dispatch({ type: 'filterChanged', filterKey });
  }

  const { request } = state;
  useEffect(() => {
    const controller = new AbortController();
    const ids = request.filterKey ? request.filterKey.split(',') : [];

    fetchProducts({ categoryIds: ids, page: request.page, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then(({ data, pagination }) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'loaded', request, data, totalItems: pagination.totalItems });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) dispatch({ type: 'failed', request, error });
      });

    return () => controller.abort();
  }, [request]);

  return {
    items: state.items,
    totalItems: state.totalItems,
    status: state.status,
    error: state.error,
    hasMore: state.status === 'success' && state.items.length < state.totalItems,
    loadMore: () => dispatch({ type: 'loadMore' }),
    retry: () => dispatch({ type: 'retry' }),
  };
}
