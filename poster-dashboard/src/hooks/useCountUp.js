import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Animate a number from 0 → target with exponential ease-out. Reduced-motion safe. */
export function useCountUp(target, { duration = 1, decimals = 0 } = {}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -9 * p);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  return decimals ? value.toFixed(decimals) : Math.round(value);
}
