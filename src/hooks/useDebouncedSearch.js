import { useState, useEffect } from 'react';

/** `initial` starts both values there (a list restoring its search), so no debounce fires for it. */
const useDebouncedSearch = (delay = 400, initial = '') => {
  const [searchText, setSearchText] = useState(initial);
  const [debouncedSearch, setDebouncedSearch] = useState(initial);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), delay);
    return () => clearTimeout(timer);
  }, [searchText, delay]);

  return { searchText, setSearchText, debouncedSearch };
};

export default useDebouncedSearch;
