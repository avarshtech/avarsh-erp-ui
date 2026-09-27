import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBuyers } from '../../../../services/master/buyerService';
import { getSuppliers } from '../../../../services/master/supplierService';
import { getAllSizePresets } from '../../../../services/master/sizePresetService';
import { getActiveProcesses } from '../../../../services/master/processService';
import { getActiveOverheads } from '../../../../services/master/overheadService';
import { getAllCategories } from '../../../../services/master/masterDataService';
import useStoreList from './useStoreList';
import {
  resolveCategorySlots, sizePresetGroups, toBuyerOptions, toCostMasterOptions, toSupplierOptions, unwrapList,
} from '../model/masterOptions';

const loadManufacturing = () => getActiveProcesses('Manufacturing');

/** Every master list the sheet's pickers read, with an `add` for each quick-create. */
export default function useSheetMasters() {
  const [buyers, addBuyer] = useStoreList('buyers', getBuyers);
  const [suppliers, addSupplier] = useStoreList('suppliers', getSuppliers);
  const [presets, addSizePreset] = useStoreList('sizePresets', getAllSizePresets);
  const [local, setLocal] = useState({ processes: [], overheads: [], categories: {}, loaded: false });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([loadManufacturing(), getActiveOverheads(), getAllCategories()]).then(([p, o, c]) => {
      if (cancelled) return;
      const value = (r) => (r.status === 'fulfilled' ? unwrapList(r.value) : []);
      setLocal({
        processes: toCostMasterOptions(value(p), 'processName'),
        overheads: toCostMasterOptions(value(o), 'overheadName'),
        categories: resolveCategorySlots(value(c)),
        loaded: true,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const addProcess = useCallback((option) => setLocal((s) => ({ ...s, processes: [...s.processes, option] })), []);
  const addOverhead = useCallback((option) => setLocal((s) => ({ ...s, overheads: [...s.overheads, option] })), []);

  return useMemo(() => ({
    buyerOptions: toBuyerOptions(buyers),
    supplierOptions: toSupplierOptions(suppliers),
    sizeGroups: sizePresetGroups(presets),
    processOptions: local.processes,
    overheadOptions: local.overheads,
    categories: local.categories,
    loaded: local.loaded,
    addBuyer, addSupplier, addSizePreset, addProcess, addOverhead,
  }), [buyers, suppliers, presets, local, addBuyer, addSupplier, addSizePreset, addProcess, addOverhead]);
}
