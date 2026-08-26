import { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Global Store Context
 * Provides a centralized state management for API data caching
 * Reduces redundant API calls and provides consistent data across components
 */

const StoreContext = createContext(null);

// Initial state for all data types
const initialState = {
  // Master Data
  categories: [],
  subCategories: [],
  itemTypes: [],
  attributes: [],
  uoms: [],
  variants: [],
  
  // Suppliers
  suppliers: [],
  
  // Buyers
  buyers: [],

  // Styles
  styles: [],

  // Terms & Conditions
  termsConditions: [],

  // Payment Terms
  paymentTerms: [],

  // Size Presets
  sizePresets: [],

  // Users & Roles
  users: [],
  roles: [],

  // Order numbers of SAMPLE-type orders (drives sample badges across lifecycle screens)
  sampleOrderNos: [],

  // Loading states per data type
  loading: {
    categories: false,
    subCategories: false,
    itemTypes: false,
    attributes: false,
    uoms: false,
    variants: false,
    suppliers: false,
    buyers: false,
    styles: false,
    termsConditions: false,
    paymentTerms: false,
    sizePresets: false,
    users: false,
    roles: false,
    sampleOrderNos: false,
  },

  // Error states per data type
  errors: {
    categories: null,
    subCategories: null,
    itemTypes: null,
    attributes: null,
    uoms: null,
    variants: null,
    suppliers: null,
    buyers: null,
    styles: null,
    termsConditions: null,
    paymentTerms: null,
    sizePresets: null,
    users: null,
    roles: null,
    sampleOrderNos: null,
  },

  // Last fetched timestamps (for cache invalidation)
  lastFetched: {
    categories: null,
    subCategories: null,
    itemTypes: null,
    attributes: null,
    uoms: null,
    variants: null,
    suppliers: null,
    buyers: null,
    styles: null,
    termsConditions: null,
    paymentTerms: null,
    sizePresets: null,
    users: null,
    roles: null,
    sampleOrderNos: null,
  },
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const StoreProvider = ({ children }) => {
  const [state, setState] = useState(initialState);

  /**
   * Set data for a specific key
   * @param {string} key - Data key (e.g., 'categories', 'suppliers')
   * @param {Array} data - Data array to store
   */
  const setData = useCallback((key, data) => {
    setState(prev => ({
      ...prev,
      [key]: data,
      lastFetched: {
        ...prev.lastFetched,
        [key]: Date.now(),
      },
      errors: {
        ...prev.errors,
        [key]: null,
      },
    }));
  }, []);

  /**
   * Set loading state for a specific key
   * @param {string} key - Data key
   * @param {boolean} isLoading - Loading state
   */
  const setLoading = useCallback((key, isLoading) => {
    setState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        [key]: isLoading,
      },
    }));
  }, []);

  /**
   * Set error for a specific key
   * @param {string} key - Data key
   * @param {string|null} error - Error message
   */
  const setError = useCallback((key, error) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [key]: error,
      },
    }));
  }, []);

  /**
   * Check if cache is valid for a specific key
   * @param {string} key - Data key
   * @returns {boolean} - Whether cache is still valid
   */
  const isCacheValid = useCallback((key) => {
    const lastFetched = state.lastFetched[key];
    if (!lastFetched) return false;
    return Date.now() - lastFetched < CACHE_DURATION;
  }, [state.lastFetched]);

  /**
   * Invalidate cache for a specific key (forces refetch on next access)
   * @param {string} key - Data key to invalidate
   */
  const invalidateCache = useCallback((key) => {
    setState(prev => ({
      ...prev,
      lastFetched: {
        ...prev.lastFetched,
        [key]: null,
      },
    }));
  }, []);

  /**
   * Clear all data and reset to initial state
   */
  const clearStore = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Add item to a collection
   * @param {string} key - Data key
   * @param {Object} item - Item to add
   */
  const addItem = useCallback((key, item) => {
    setState(prev => ({
      ...prev,
      [key]: [...prev[key], item],
    }));
  }, []);

  /**
   * Update item in a collection
   * @param {string} key - Data key
   * @param {number|string} id - Item ID
   * @param {Object} updates - Updated item data
   */
  const updateItem = useCallback((key, id, updates) => {
    setState(prev => ({
      ...prev,
      [key]: prev[key].map(item => 
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  /**
   * Remove item from a collection
   * @param {string} key - Data key
   * @param {number|string} id - Item ID to remove
   */
  const removeItem = useCallback((key, id) => {
    setState(prev => ({
      ...prev,
      [key]: prev[key].filter(item => item.id !== id),
    }));
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    ...state,
    
    // Actions
    setData,
    setLoading,
    setError,
    isCacheValid,
    invalidateCache,
    clearStore,
    addItem,
    updateItem,
    removeItem,
  }), [
    state,
    setData,
    setLoading,
    setError,
    isCacheValid,
    invalidateCache,
    clearStore,
    addItem,
    updateItem,
    removeItem,
  ]);

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

/**
 * Hook to access the store
 * @returns {Object} Store context value
 */
export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

/**
 * Hook to access specific data with loading/error states
 * @param {string} key - Data key
 * @returns {Object} { data, loading, error }
 */
export const useStoreData = (key) => {
  const store = useStore();
  return {
    data: store[key] || [],
    loading: store.loading[key] || false,
    error: store.errors[key] || null,
    isCacheValid: store.isCacheValid(key),
  };
};

export default StoreContext;
