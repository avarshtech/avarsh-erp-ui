import { useState, useEffect } from 'react';

const useDebouncedSearch = (delay = 400) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), delay);
    return () => clearTimeout(timer);
  }, [searchText, delay]);

  return { searchText, setSearchText, debouncedSearch };
};

export default useDebouncedSearch;
