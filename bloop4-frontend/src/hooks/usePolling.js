import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Demana `load(signal)` en muntar-se i després cada `intervalMs` mentre `enabled` (decisió del
 * Sprint 2: consulta periòdica en lloc de SSE). Si una consulta falla, es conserva l'última dada
 * bona i `stale` passa a true fins que una altra consulta funciona.
 * @returns {{ data, error, status: 'loading' | 'success' | 'error', stale: boolean, refresh: () => void }}
 */
export function usePolling(load, intervalMs, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, status: 'loading', stale: false });
  const loadRef = useRef(load);
  loadRef.current = load;
  const controllerRef = useRef(null);

  const refresh = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, status: 'success', stale: false });
      },
      (error) => {
        if (controller.signal.aborted) return;
        setState((s) => (s.data === null ? { data: null, error, status: 'error', stale: false } : { ...s, error, stale: true }));
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [enabled, intervalMs, refresh]);

  return { ...state, refresh };
}
