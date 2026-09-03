import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import {
  listSampleTypes, listCouriers, listRejectionReasons, listHsnCodes,
} from '../services/sr/srService';

const EMPTY = Object.freeze({
  sampleTypes: [], couriers: [], rejectionReasons: [], hsnCodes: [],
});

/**
 * Sample Request master data (StoreContext-cached, 5-min TTL): the sample type
 * list, the courier list, the rejection-reason codes and the HSN table —
 * fetched once and shared by the SR, dispatch, invoice and comments screens.
 *
 * Sample types and couriers are stored by `id`; rejection reasons and HSN rows
 * are stored by `code`, so `options()`-style helpers keep a renamed label from
 * rewriting history.
 */
const useSampleMasters = () => {
  const { sampleMasters, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('sampleMasters') || loading.sampleMasters) return;
    setLoading('sampleMasters', true);
    Promise.all([
      listSampleTypes(), listCouriers(), listRejectionReasons(), listHsnCodes(),
    ])
      .then(([sampleTypes, couriers, rejectionReasons, hsnCodes]) => setData('sampleMasters', {
        sampleTypes: sampleTypes || [],
        couriers: couriers || [],
        rejectionReasons: rejectionReasons || [],
        hsnCodes: hsnCodes || [],
      }))
      .catch(() => setData('sampleMasters', EMPTY))
      .finally(() => setLoading('sampleMasters', false));
  }, [isCacheValid, loading.sampleMasters, setData, setLoading]);

  const masters = sampleMasters || EMPTY;

  const sampleTypeOptions = useMemo(
    () => masters.sampleTypes.map((t) => ({ value: t.id, label: t.name })),
    [masters.sampleTypes],
  );

  const courierOptions = useMemo(
    () => masters.couriers.map((c) => ({ value: c.id, label: c.name })),
    [masters.couriers],
  );

  const rejectionReasonOptions = useMemo(
    () => masters.rejectionReasons.map((r) => ({ value: r.code, label: r.label })),
    [masters.rejectionReasons],
  );

  /** HSN code for a fabric category, falling back to the Default row. */
  const hsnFor = useCallback((category) => {
    const hit = masters.hsnCodes.find(
      (c) => category && c.category.toLowerCase() === String(category).toLowerCase(),
    );
    return (hit || masters.hsnCodes.find((c) => c.category === 'Default') || {}).code || '';
  }, [masters.hsnCodes]);

  return {
    sampleTypes: masters.sampleTypes,
    couriers: masters.couriers,
    rejectionReasons: masters.rejectionReasons,
    hsnCodes: masters.hsnCodes,
    sampleTypeOptions,
    courierOptions,
    rejectionReasonOptions,
    hsnFor,
    loading: loading.sampleMasters,
  };
};

export default useSampleMasters;
