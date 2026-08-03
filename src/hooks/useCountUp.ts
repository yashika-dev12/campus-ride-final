import { useEffect, useRef, useState } from "react";

interface CountUpOptions {
  /** Animation length in milliseconds. */
  duration?: number;
}

/**
 * Smoothly counts from the previously shown value up (or down) to `target`
 * with an ease-out curve. Animates on mount (from 0) and again whenever
 * `target` changes, so metric updates feel live.
 *
 * SSR-safe: the initial render returns `target` (matching the server output),
 * then the count-up runs client-side after hydration.
 */
export function useCountUp(target: number, { duration = 1000 }: CountUpOptions = {}): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const mountedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // First run animates up from zero; later runs animate from where we are.
    const from = mountedRef.current ? valueRef.current : 0;
    mountedRef.current = true;

    if (from === target) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const next = from + (target - from) * eased;
      valueRef.current = next;
      setValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}
