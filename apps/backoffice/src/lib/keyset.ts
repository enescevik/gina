import { useCallback, useEffect, useRef, useState } from "react";

export type KeysetPage<T> = { rows: T[]; has_more: boolean; next_cursor: string | null };

/**
 * C07: sunucu keyset sayfalaması için ortak liste durumu.
 * - Süzgeç anahtarı (`filterKey`) değişince liste ve cursor sıfırlanır; eski süzgecin cursor'ı yeni sorguya gitmez.
 * - "Daha fazla" yalnız sunucunun verdiği cursor ile ister; aynı kimlik ikinci kez eklenmez (`page_out_of_order`).
 * - Eski isteklerin yanıtları sıra numarasıyla yok sayılır.
 */
export function useKeysetList<T>(
  fetchPage: (cursor: string | null) => Promise<KeysetPage<T>>,
  filterKey: string,
  idOf: (row: T) => string,
  enabled = true,
) {
  const [state, setState] = useState<{ key: string; rows: T[]; cursor: string | null; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pageError, setPageError] = useState(false);
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const loadFirst = useCallback(async (key: string) => {
    const request = ++seq.current;
    setLoading(true);
    setError(null);
    setPageError(false);
    try {
      const page = await fetchRef.current(null);
      if (request !== seq.current) return;
      setState({ key, rows: page.rows, cursor: page.next_cursor, hasMore: page.has_more });
    } catch (e) {
      if (request !== seq.current) return;
      setState(null);
      setError(e);
    } finally {
      if (request === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => void loadFirst(filterKey), 0);
    return () => clearTimeout(timer);
  }, [enabled, filterKey, loadFirst]);

  const loadMore = useCallback(async () => {
    const current = state;
    if (!current?.cursor || loading || current.key !== filterKey) return;
    const request = ++seq.current;
    setLoading(true);
    setPageError(false);
    try {
      const page = await fetchRef.current(current.cursor);
      if (request !== seq.current) return;
      const seen = new Set(current.rows.map(idOf));
      if (page.rows.some((r) => seen.has(idOf(r)))) throw Error("page_out_of_order");
      setState({ key: current.key, rows: [...current.rows, ...page.rows], cursor: page.next_cursor, hasMore: page.has_more });
    } catch (e) {
      if (request !== seq.current) return;
      setPageError(true);
      setError(e);
    } finally {
      if (request === seq.current) setLoading(false);
    }
  }, [state, loading, filterKey, idOf]);

  const fresh = state && state.key === filterKey ? state : null;
  return {
    rows: fresh?.rows ?? null,
    hasMore: !!fresh?.hasMore,
    loading,
    error,
    pageError,
    loadMore,
    reload: () => void loadFirst(filterKey),
  };
}
