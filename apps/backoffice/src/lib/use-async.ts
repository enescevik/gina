import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "./auth";

/**
 * Admin oturumu hazır olunca veri yükler. `key` değişince yeniden yükler; `reload()` elle yeniler.
 * Yükleyici her render'da güncel tutulur (ref), bu yüzden kapanıştaki filtreler hep günceldir.
 */
export function useAdminQuery<T>(load: () => Promise<T>, key: unknown[] = []) {
  const { isAdmin } = useAuth();
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ data: T | null; error: unknown; doneFor: string | null }>({
    data: null,
    error: null,
    doneFor: null,
  });
  const requestKey = `${JSON.stringify(key)}:${tick}`;

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, doneFor: requestKey });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ data: s.data, error, doneFor: requestKey }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, requestKey]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return { data: state.data, error: state.error, loading: state.doneFor !== requestKey, reload };
}

/** Supabase yanıtındaki hatayı fırlatır, veriyi döndürür. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
