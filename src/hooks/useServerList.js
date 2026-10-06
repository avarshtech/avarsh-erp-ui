import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import useDebouncedSearch from './useDebouncedSearch';
import { toastUnlessHandled } from '../utils/apiError';

const firstPage = (p) => (p.current === 1 ? p : { ...p, current: 1 });

/**
 * A list that pages and filters on the server. `fetchPage({ page, size, search, ...filters })` (page 1-based)
 * resolves to `{ content, totalElements }` and must be stable. A new filter or search goes back to page 1; an
 * answer that arrives after a newer request was sent is dropped, so a slow page never overwrites a fresh one.
 */
const useServerList = (fetchPage, initialFilters, errorText = 'Could not load the list') => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setLoading(true);
    try {
      const page = await fetchPage({
        page: pagination.current, size: pagination.pageSize, search: debouncedSearch.trim() || undefined, ...filters,
      });
      if (mine === latest.current) setData(page);
    } catch (e) {
      if (mine === latest.current) toastUnlessHandled(message, e, errorText);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [fetchPage, pagination, debouncedSearch, filters, message, errorText]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPagination(firstPage); }, [debouncedSearch]);

  const setFilter = useCallback((key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPagination(firstPage);
  }, []);

  const onTableChange = useCallback((p) => setPagination({ current: p.current, pageSize: p.pageSize }), []);

  return {
    rows: data.content, total: data.totalElements, loading, load, filters, setFilter,
    pagination, onTableChange, searchText, setSearchText, debouncedSearch,
  };
};

export default useServerList;
