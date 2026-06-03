import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Calls `fn` immediately, then every `intervalMs`. Pauses interval ticks while
 * the document is hidden. Clears the interval on unmount. `deps` re-arms it.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  deps: unknown[],
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void run();
    const id = setInterval(() => {
      if (!document.hidden) {
        void run();
      }
    }, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [intervalMs, run, ...deps]);

  return { data, error, loading, refetch: run };
}
