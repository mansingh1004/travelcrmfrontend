import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Server-side pagination for any endpoint that returns the `PagedApiResponse` envelope
 * (`{ data: [...], pagination: { page, size, totalElements, totalPages, hasNext, ... } }`).
 *
 * Every list endpoint in this backend is paged. Calling one with a bare `API.get(url)` returns
 * page 0 at the server's default size and looks like the complete list — which is how rows past
 * the first page silently "disappeared" from the masters screens. This hook is the replacement:
 * it owns page/size/search/filter state, sends them to the server, and hands back the pagination
 * block so a pager can render.
 *
 * @param fetcher  ({page, size, sortBy, sortDir, q, ...filters}) => axios promise
 * @param options  initial size / sort, and the filter object (server-side, NOT client-side)
 */
export function usePagedList(fetcher, {
  size: initialSize = 25,
  sortBy,
  sortDir = "asc",
  filters = {},
  debounceMs = 300,
} = {}) {
  const [rows,     setRows]     = useState([]);
  const [meta,     setMeta]     = useState(null);
  const [page,     setPage]     = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const [q,        setQ]        = useState("");        // what the input shows
  const [debouncedQ, setDebouncedQ] = useState("");    // what actually gets sent
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Filters arrive as a fresh object literal on every render, so identity is useless as a dep.
  // Serialising is what makes the effect fire on VALUE change instead of on every render.
  const filterKey = JSON.stringify(filters);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  // Any narrowing change invalidates the current page number. Without this you stay on page 5
  // of a result that now has 2 pages and stare at an empty table.
  useEffect(() => { setPage(0); }, [debouncedQ, pageSize, filterKey]);

  // Guards against out-of-order responses: a slow page-1 request must not overwrite the page-2
  // rows that already came back. Only the newest request in flight is allowed to render.
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetcher({
        page,
        size: pageSize,
        sortBy,
        sortDir,
        q: debouncedQ || undefined,
        ...JSON.parse(filterKey),
      });
      if (id !== reqId.current) return;            // a newer request already won
      const body = res?.data ?? {};
      setRows(Array.isArray(body.data) ? body.data : []);
      setMeta(body.pagination ?? null);
      setError(null);
    } catch (err) {
      if (id !== reqId.current) return;
      // Interceptor already toasted 401/403/429/5xx; surface the rest to the call site.
      setError(err);
      setRows([]);
      setMeta(null);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [fetcher, page, pageSize, sortBy, sortDir, debouncedQ, filterKey]);

  useEffect(() => { load(); }, [load]);

  const isFiltered = useMemo(
    () => Boolean(debouncedQ) || Object.values(JSON.parse(filterKey)).some(v => v !== "" && v != null),
    [debouncedQ, filterKey],
  );

  return {
    rows, meta, loading, error,
    page, setPage,
    pageSize, setPageSize,
    q, setQ,
    isFiltered,
    total: meta?.totalElements ?? 0,
    totalPages: meta?.totalPages ?? 0,
    reload: load,
  };
}
