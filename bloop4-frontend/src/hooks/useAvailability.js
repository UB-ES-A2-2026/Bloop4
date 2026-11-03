import { useEffect, useState } from 'react';
import { fetchAvailability } from '../api/catalogApi';

/**
 * Disponibilitat d'un producte per a un interval { from, to } (Date) o null.
 * status: idle (sense interval) | loading | success | error. Cada canvi d'interval avorta la
 * petició anterior, així que una resposta antiga no pot trepitjar la nova.
 */
export function useAvailability(productId, range) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const from = range?.from?.getTime();
  const to = range?.to?.getTime();

  useEffect(() => {
    if (from === undefined || to === undefined) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetchAvailability(productId, { from: new Date(from), to: new Date(to) }, { signal: controller.signal })
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', data: null, error });
      });
    return () => controller.abort();
  }, [productId, from, to, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
