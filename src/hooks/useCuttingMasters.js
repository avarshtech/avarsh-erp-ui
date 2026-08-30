import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { getFabricTypes, getCuttingTables, getCuttingLookups } from '../services/production/cuttingMasterService';

const EMPTY = Object.freeze({ fabricTypes: [], cuttingTables: [], lookups: {} });

/**
 * Cutting-room master data (StoreContext-cached, 5-min TTL): fabric types, cut /
 * lay tables and every code list the screens drop down — fetched once and shared
 * by all ten cutting tabs.
 *
 * Documents store the lookup `code`; `options()` returns `{ value: code, label: name }`
 * so a renamed label never rewrites history.
 */
const useCuttingMasters = () => {
  const { cuttingMasters, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('cuttingMasters') || loading.cuttingMasters) return;
    setLoading('cuttingMasters', true);
    Promise.all([getFabricTypes(), getCuttingTables(), getCuttingLookups()])
      .then(([fabricTypes, cuttingTables, lookups]) => setData('cuttingMasters', {
        fabricTypes: fabricTypes || [], cuttingTables: cuttingTables || [], lookups: lookups || {},
      }))
      .catch(() => setData('cuttingMasters', EMPTY))
      .finally(() => setLoading('cuttingMasters', false));
  }, [isCacheValid, loading.cuttingMasters, setData, setLoading]);

  const masters = cuttingMasters || EMPTY;

  /** Dropdown options for a lookup type, e.g. options('TMB_COMMENT'). */
  const options = useCallback((lookupType) => (masters.lookups[lookupType] || [])
    .map((entry) => ({ value: entry.code, label: entry.name })), [masters.lookups]);

  /**
   * Options for a lookup whose meaning is its number, not its code — bundle
   * sizes, for instance, are stored as the piece count itself.
   */
  const numericOptions = useCallback((lookupType) => (masters.lookups[lookupType] || [])
    .filter((entry) => entry.numericValue != null)
    .map((entry) => ({ value: Number(entry.numericValue), label: entry.name })), [masters.lookups]);

  /** Label for a stored code, falling back to the code when the entry is gone. */
  const labelOf = useCallback((lookupType, code) => (masters.lookups[lookupType] || [])
    .find((entry) => entry.code === code)?.name ?? code ?? '—', [masters.lookups]);

  /** Tuning number by CuttingThresholds code; `fallback` covers a deactivated row. */
  const threshold = useCallback((code, fallback = 0) => {
    const entry = (masters.lookups.THRESHOLD || []).find((t) => t.code === code);
    return entry?.numericValue != null ? Number(entry.numericValue) : fallback;
  }, [masters.lookups]);

  /** Fabric type record (relaxation hours, shrinkage, stock UOM) by its name. */
  const fabricTypeByName = useCallback((name) => masters.fabricTypes
    .find((f) => f.name?.toLowerCase() === String(name || '').toLowerCase()), [masters.fabricTypes]);

  // Documents reference a cutting table by id, so that is what the option carries.
  const tableOptions = useMemo(
    () => masters.cuttingTables.map((t) => ({ value: t.id, label: t.name })),
    [masters.cuttingTables],
  );

  return {
    fabricTypes: masters.fabricTypes,
    cuttingTables: masters.cuttingTables,
    tableOptions,
    options,
    numericOptions,
    labelOf,
    threshold,
    fabricTypeByName,
    loading: loading.cuttingMasters,
  };
};

export default useCuttingMasters;
