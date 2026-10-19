import { useEffect, useState } from 'react';
import { fetchCategories } from '../api/catalogApi';

/** Carrega les categories un cop. `retry` ho torna a provar després d'un error. */
export function useCategories() {
  const [state, setState] = useState({ status: 'loading', categories: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));

    fetchCategories({ signal: controller.signal })
      .then((categories) => setState({ status: 'success', categories, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', categories: [], error });
      });

    return () => controller.abort();
  }, [attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
