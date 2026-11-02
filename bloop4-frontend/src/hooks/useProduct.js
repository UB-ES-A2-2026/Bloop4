import { useEffect, useState } from 'react';
import { fetchProduct } from '../api/catalogApi';

/** Carrega la fitxa d'un producte. status: loading | success | notFound | error */
export function useProduct(id) {
  const [state, setState] = useState({ status: 'loading', product: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', product: null, error: null });

    fetchProduct(id, { signal: controller.signal })
      .then((product) => setState({ status: 'success', product, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Un id mal format (400) també vol dir que el producte no existeix.
        const notFound = error.status === 404 || error.status === 400;
        setState({ status: notFound ? 'notFound' : 'error', product: null, error });
      });

    return () => controller.abort();
  }, [id, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
