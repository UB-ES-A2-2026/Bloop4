import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePolling } from './usePolling';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('usePolling', () => {
  it('demana les dades en muntar-se i cada interval', async () => {
    const load = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const { result } = renderHook(() => usePolling(load, 10_000));
    await flush();
    expect(result.current.data).toBe('a');
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result.current.data).toBe('b');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('si una consulta falla conserva l\'última dada i la marca com a desactualitzada', async () => {
    const load = vi.fn().mockResolvedValueOnce('a').mockImplementationOnce(async () => { throw new Error('xarxa'); }).mockResolvedValueOnce('c');
    const { result } = renderHook(() => usePolling(load, 1000));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current).toMatchObject({ data: 'a', stale: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current).toMatchObject({ data: 'c', stale: false });
  });

  it('sense cap dada bona, l\'error és l\'estat; desactivat, no demana res', async () => {
    const failing = vi.fn(async () => { throw new Error('xarxa'); });
    const { result } = renderHook(() => usePolling(failing, 1000));
    await flush();
    expect(result.current.status).toBe('error');

    const idle = vi.fn();
    renderHook(() => usePolling(idle, 1000, { enabled: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(idle).not.toHaveBeenCalled();
  });
});
