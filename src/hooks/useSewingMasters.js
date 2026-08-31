import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import {
  getProductionLines, getMachineTypes, getSewingOperations,
  getSewingDefectTypes, getSewingLookups, getIncentiveSlabs,
} from '../services/production/sewingMasterService';

const EMPTY = Object.freeze({
  lines: [], machineTypes: [], operations: [], defectTypes: {}, lookups: {}, incentiveSlabs: [],
});

/**
 * Sewing master data (StoreContext-cached, 5-min TTL): production lines, machine
 * types, the operation library, the defect taxonomy, every code list and the
 * incentive slabs — fetched once and shared by all ten sewing tabs.
 *
 * Documents store the lookup `code`; `options()` returns `{ value: code, label: name }`
 * so a renamed label never rewrites history.
 */
const useSewingMasters = () => {
  const { sewingMasters, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('sewingMasters') || loading.sewingMasters) return;
    setLoading('sewingMasters', true);
    Promise.all([
      getProductionLines(), getMachineTypes(), getSewingOperations(),
      getSewingDefectTypes(), getSewingLookups(), getIncentiveSlabs(),
    ])
      .then(([lines, machineTypes, operations, defectTypes, lookups, incentiveSlabs]) => setData('sewingMasters', {
        lines: lines || [],
        machineTypes: machineTypes || [],
        operations: operations || [],
        defectTypes: defectTypes || {},
        lookups: lookups || {},
        incentiveSlabs: incentiveSlabs || [],
      }))
      .catch(() => setData('sewingMasters', EMPTY))
      .finally(() => setLoading('sewingMasters', false));
  }, [isCacheValid, loading.sewingMasters, setData, setLoading]);

  const masters = sewingMasters || EMPTY;

  /** Dropdown options for a lookup type, e.g. options('DAMAGE_REASON'). */
  const options = useCallback((lookupType) => (masters.lookups[lookupType] || [])
    .map((entry) => ({ value: entry.code, label: entry.name })), [masters.lookups]);

  /** Label for a stored code, falling back to the code when the entry is gone. */
  const labelOf = useCallback((lookupType, code) => (masters.lookups[lookupType] || [])
    .find((entry) => entry.code === code)?.name ?? code ?? '—', [masters.lookups]);

  /** Tuning number by SewingThresholds code; `fallback` covers a deactivated row. */
  const threshold = useCallback((code, fallback = 0) => {
    const entry = (masters.lookups.THRESHOLD || []).find((t) => t.code === code);
    return entry?.numericValue != null ? Number(entry.numericValue) : fallback;
  }, [masters.lookups]);

  /** Lines of one factory — how the Unit select filters the Line select. */
  const linesByFactory = useCallback((factoryId) => masters.lines
    .filter((l) => !factoryId || l.factoryId === factoryId), [masters.lines]);

  const lineOptions = useMemo(
    () => masters.lines.map((l) => ({ value: l.id, label: l.name })),
    [masters.lines],
  );

  const machineOptions = useMemo(
    () => masters.machineTypes.map((m) => ({ value: m.id, label: m.name })),
    [masters.machineTypes],
  );

  const operationOptions = useMemo(
    () => masters.operations.map((o) => ({ value: o.id, label: o.name })),
    [masters.operations],
  );

  /** Defect categories, and the types under one — the two end-line dropdowns. */
  const defectCategories = useMemo(() => Object.keys(masters.defectTypes), [masters.defectTypes]);
  const defectTypesOf = useCallback((category) => (masters.defectTypes[category] || [])
    .map((d) => ({ value: d.name, label: d.name })), [masters.defectTypes]);

  return {
    lines: masters.lines,
    machineTypes: masters.machineTypes,
    operations: masters.operations,
    incentiveSlabs: masters.incentiveSlabs,
    lineOptions,
    machineOptions,
    operationOptions,
    linesByFactory,
    defectCategories,
    defectTypesOf,
    options,
    labelOf,
    threshold,
    loading: loading.sewingMasters,
  };
};

export default useSewingMasters;
