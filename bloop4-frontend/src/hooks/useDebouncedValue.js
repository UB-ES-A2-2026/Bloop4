import { useEffect, useState } from 'react';

/** Retorna `value` amb retard: només s'actualitza quan fa `delayMs` que no canvia. */
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
