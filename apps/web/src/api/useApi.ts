import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, toApiRequestError } from "./client";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiRequestError | null;
}

export interface UseApiResult<T> extends ApiState<T> {
  reload: () => void;
}

/**
 * Generic data-loading hook: runs `loader` when `deps` change,
 * exposes loading / error / data and a manual `reload`.
 */
export function useApi<T>(loader: () => Promise<T>, deps: readonly unknown[]): UseApiResult<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    loader()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setState({ data: null, loading: false, error: toApiRequestError(err) });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
