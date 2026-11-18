import { useEffect, useState } from 'react';

/**
 * Segons que falten fins a `deadline` (ISO o Date), actualitzats cada segon. Retorna null si
 * no hi ha data límit i 0 quan ja ha passat.
 */
export function useCountdown(deadline) {
  const target = deadline ? new Date(deadline).getTime() : null;
  const remaining = () => (target === null ? null : Math.max(0, Math.ceil((target - Date.now()) / 1000)));
  const [seconds, setSeconds] = useState(remaining);

  useEffect(() => {
    setSeconds(remaining());
    if (target === null) return undefined;
    const timer = setInterval(() => {
      const left = remaining();
      setSeconds(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return seconds;
}
