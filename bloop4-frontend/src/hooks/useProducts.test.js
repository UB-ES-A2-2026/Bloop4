import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProducts } from './useProducts';
import { fetchProducts } from '../api/catalogApi';
import { makePage } from '../test/fixtures';

vi.mock('../api/catalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProducts: vi.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => fetchProducts.mockReset());

describe('useProducts', () => {
  it('envia el filtre ordenat, de manera que l\'ordre de les categories no importa', async () => {
    fetchProducts.mockResolvedValue(makePage(0));
    const { rerender } = renderHook(({ ids }) => useProducts(ids), { initialProps: { ids: ['b', 'a'] } });
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(1));
    expect(fetchProducts.mock.calls[0][0].categoryIds).toEqual(['a', 'b']);

    // Mateix filtre en un altre ordre → no es torna a demanar.
    rerender({ ids: ['a', 'b'] });
    await act(async () => {});
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it('en canviar el filtre avorta la petició anterior i ignora la seva resposta', async () => {
    const first = deferred();
    fetchProducts.mockReturnValueOnce(first.promise).mockResolvedValueOnce(makePage(2, { firstIndex: 100 }));

    const { result, rerender } = renderHook(({ ids }) => useProducts(ids), { initialProps: { ids: ['a'] } });
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(1));
    const firstSignal = fetchProducts.mock.calls[0][1].signal;

    rerender({ ids: ['b'] });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(firstSignal.aborted).toBe(true);

    // La resposta del filtre antic arriba tard i no ha de trepitjar la nova.
    await act(async () => first.resolve(makePage(5)));
    expect(result.current.items.map((p) => p.name)).toEqual(['Producto 101', 'Producto 102']);
    expect(result.current.totalItems).toBe(2);
  });

  it('hasMore indica si queden pàgines per carregar', async () => {
    fetchProducts.mockResolvedValue(makePage(24, { totalItems: 25 }));
    const { result } = renderHook(() => useProducts([]));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.hasMore).toBe(true);
  });
});
