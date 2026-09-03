import { useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import {
  listSampleTypes, listCouriers, listRejectionReasons, getFeedbackCategoryLabels,
} from '../services/sr/srService';

const EMPTY = Object.freeze({
  sampleTypes: [], couriers: [], rejectionReasons: [], feedbackLabels: {},
});

/**
 * Sample Request master data (StoreContext-cached, 5-min TTL): the sample type
 * list, the courier list, the rejection-reason codes and the feedback category
 * labels — fetched once and shared by the SR, dispatch and comments screens
 * instead of each one fetching its own copy.
 *
 * Documents store the `id` of a type or courier and the `code` of a reason, so
 * the option helpers keep a renamed label from rewriting history. HSN codes are
 * deliberately not here: only the invoice form needs them, through the facade's
 * getHsnDefault.
 */
const useSampleMasters = () => {
  const { sampleMasters, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('sampleMasters') || loading.sampleMasters) return;
    setLoading('sampleMasters', true);
    Promise.all([
      listSampleTypes(), listCouriers(), listRejectionReasons(), getFeedbackCategoryLabels(),
    ])
      .then(([sampleTypes, couriers, rejectionReasons, feedbackLabels]) => setData('sampleMasters', {
        sampleTypes: sampleTypes || [],
        couriers: couriers || [],
        rejectionReasons: rejectionReasons || [],
        feedbackLabels: feedbackLabels || {},
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

  return {
    ...masters,
    sampleTypeOptions,
    courierOptions,
    rejectionReasonOptions,
    loading: loading.sampleMasters,
  };
};

export default useSampleMasters;
