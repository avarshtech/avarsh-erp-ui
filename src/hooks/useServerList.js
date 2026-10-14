import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { useLocation, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import useDebouncedSearch from './useDebouncedSearch';
import { toastUnlessHandled } from '../utils/apiError';
import { rememberListQuery } from '../utils/listMemory';

const firstPage = (p) => (p.current === 1 ? p : { ...p, current: 1 });
const DAY = 'YYYY-MM-DD';
const PAGE_SIZE = 10;

/** A filter value as a URL parameter, or null when it is empty. */
const encode = (value, type) => {
  if (value === undefined || value === null || value === '') return null;
  if (type === 'dateRange') {
    return Array.isArray(value) && value[0] && value[1]
      ? `${dayjs(value[0]).format(DAY)}~${dayjs(value[1]).format(DAY)}`
      : null;
  }
  if (Array.isArray(value)) return value.length ? value.join('~') : null;
  return String(value);
};

/** A URL parameter back to a filter value; undefined when it cannot be read. */
const decode = (raw, type) => {
  if (type === 'dateRange') {
    const [from, to] = raw.split('~').map((d) => dayjs(d));
    return from?.isValid() && to?.isValid() ? [from, to] : undefined;
  }
  if (type === 'number') {
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) ? n : undefined;
  }
  if (type === 'array') return raw.split('~');
  return raw;
};

/** Page, size, sort, search and filters from the URL, falling back to the defaults. */
const readUrl = (params, initialFilters, defaultSort, filterTypes) => {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const filters = { ...initialFilters };
  Object.keys(initialFilters || {}).forEach((key) => {
    if (!params.has(key)) return;
    const value = decode(params.get(key), filterTypes[key]);
    if (value !== undefined) filters[key] = value;
  });
  const field = params.get('sort');
  const order = params.get('order');
  return {
    pagination: { current: page > 0 ? page : 1, pageSize: size > 0 ? size : PAGE_SIZE },
    sort: field && (order === 'ascend' || order === 'descend') ? { field, order } : defaultSort,
    search: params.get('q') || '',
    filters,
  };
};

/**
 * A list that pages, sorts and filters on the server.
 *
 * `fetchPage({ page, size, search, sort, direction, ...filters })` (page 1-based; sort and direction only
 * with `defaultSort`) resolves to `{ content, totalElements }` and must be stable. A new filter or search
 * goes back to page 1; an answer that arrives after a newer request was sent is dropped, so a slow page never
 * overwrites a fresh one.
 *
 * Options:
 * - `defaultSort` `{ field, order: 'ascend' | 'descend' }`: the order with no column sorter set. A column
 *   sorter replaces it; clearing the sorter returns to it. `sortOrderFor(key)` drives the columns' arrows.
 * - `urlState`: page, size, sort, search and filters live in the URL (defaults are left out, so a fresh list
 *   keeps its bare address), and the list remembers them for its form's way back (utils/listMemory).
 * - `filterTypes` `{ key: 'dateRange' | 'number' | 'array' }`: how a filter reads back from the URL; others are
 *   strings.
 *
 * `replaceRow(saved)` puts a saved record in place of the row with its id, without reloading.
 */
const useServerList = (fetchPage, initialFilters, errorText = 'Could not load the list', options = {}) => {
  const { defaultSort = null, urlState = false, filterTypes = {} } = options;
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const [initial] = useState(() => (urlState
    ? readUrl(searchParams, initialFilters, defaultSort, filterTypes)
    : { pagination: { current: 1, pageSize: PAGE_SIZE }, sort: defaultSort, search: '', filters: initialFilters }));
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(400, initial.search);
  const [filters, setFilters] = useState(initial.filters);
  const [pagination, setPagination] = useState(initial.pagination);
  const [sort, setSort] = useState(initial.sort);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);
  const lastSearch = useRef(debouncedSearch);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setLoading(true);
    try {
      const sortArgs = sort
        ? { sort: sort.field, direction: sort.order === 'ascend' ? 'asc' : 'desc' }
        : {};
      const page = await fetchPage({
        page: pagination.current, size: pagination.pageSize, search: debouncedSearch.trim() || undefined,
        ...sortArgs, ...filters,
      });
      if (mine === latest.current) setData(page);
    } catch (e) {
      if (mine === latest.current) toastUnlessHandled(message, e, errorText);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [fetchPage, pagination, sort, debouncedSearch, filters, message, errorText]);

  useEffect(() => { load(); }, [load]);

  // A new search goes back to page 1; the search a list was restored with keeps its page.
  useEffect(() => {
    if (lastSearch.current === debouncedSearch) return;
    lastSearch.current = debouncedSearch;
    setPagination(firstPage);
  }, [debouncedSearch]);

  // Mirror the state into the URL (only this list's own keys; others such as a deep link's stay).
  useEffect(() => {
    if (!urlState) return;
    const own = new URLSearchParams();
    if (pagination.current !== 1) own.set('page', String(pagination.current));
    if (pagination.pageSize !== PAGE_SIZE) own.set('size', String(pagination.pageSize));
    const isDefaultSort = sort?.field === defaultSort?.field && sort?.order === defaultSort?.order;
    if (sort && !isDefaultSort) {
      own.set('sort', sort.field);
      own.set('order', sort.order);
    }
    if (debouncedSearch.trim()) own.set('q', debouncedSearch.trim());
    Object.entries(filters || {}).forEach(([key, value]) => {
      const raw = encode(value, filterTypes[key]);
      if (raw !== null) own.set(key, raw);
    });
    const ownKeys = ['page', 'size', 'sort', 'order', 'q', ...Object.keys(initialFilters || {})];
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ownKeys.forEach((key) => next.delete(key));
      own.forEach((value, key) => next.set(key, value));
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
    rememberListQuery(pathname, own.toString());
    // initialFilters, defaultSort and filterTypes are the caller's constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState, pagination, sort, debouncedSearch, filters, pathname, setSearchParams]);

  const setFilter = useCallback((key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPagination(firstPage);
  }, []);

  const onTableChange = useCallback((p, _filters, sorter) => {
    setPagination({ current: p.current, pageSize: p.pageSize });
    if (!defaultSort || !sorter || Array.isArray(sorter)) return;
    const field = sorter.field ?? sorter.columnKey;
    setSort((prev) => {
      const next = sorter.order && field ? { field: Array.isArray(field) ? field.join('.') : field, order: sorter.order } : defaultSort;
      return prev?.field === next?.field && prev?.order === next?.order ? prev : next;
    });
    // defaultSort is the caller's constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The sort arrow a column shows: its order when the list is sorted by it, otherwise none. */
  const sortOrderFor = useCallback((key) => (sort && sort.field === key && sort !== defaultSort ? sort.order : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort]);

  /** Back to page 1, for a change outside the list's own filters (the header's branch switch). */
  const goToFirstPage = useCallback(() => setPagination(firstPage), []);

  const replaceRow = useCallback((saved) => {
    if (!saved || saved.id == null) return;
    setData((d) => ({ ...d, content: d.content.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)) }));
  }, []);

  return {
    rows: data.content, total: data.totalElements, loading, load, filters, setFilter,
    pagination, onTableChange, searchText, setSearchText, debouncedSearch,
    sort, sortOrderFor, replaceRow, goToFirstPage,
  };
};

export default useServerList;
