import { useState, useEffect } from 'react';
import { getSampleRequest, bomPreview } from '../../services/sr/srService';
import { errorText } from '../../utils/apiError';
import { isSrEditable } from '../../utils/sampleRequestConstants';

/**
 * Resolves the initial draft for the SR form's three entry modes:
 *  - new from BOM  (?bomId= / ?orderNo= — the BOMView "Raise Sample Request"
 *    path and the bare-entry picker): one call to /sample-requests/bom-preview,
 *    which materialises the BOM lines, resolves the buyer's country from its
 *    shipping locations and reads live stock. The BOM wins when both keys are
 *    present, since that is the one the user actually picked.
 *  - new bare      → needsPicker (BOM picker — any BOM, sample or bulk)
 *  - edit /:id     → the stored SR; only Draft SRs are editable
 *
 * Every mode carries `existingRequests` — what the BOM already has, per sample
 * type — so the Sample Type field can disable a taken type before anything is
 * typed. On edit it is fetched alongside the record and is best-effort: a
 * preview that fails must not stop a draft from opening.
 */
const useSampleRequestDraft = ({ id, bomId, orderNo }) => {
  const [state, setState] = useState({
    loading: true, error: null, needsPicker: false,
    mode: id ? 'edit' : 'create',
    record: null, header: null, materials: [], orderSizes: [], existingRequests: [],
  });

  const loadCreate = async () => {
    if (!bomId && !orderNo) {
      setState((s) => ({ ...s, loading: false, needsPicker: true }));
      return;
    }
    try {
      const preview = await bomPreview({ bomId, orderNo });
      setState({
        loading: false, error: null, needsPicker: false, mode: 'create',
        record: null,
        header: preview.header || null,
        materials: preview.materials || [],
        // Size run of the order — the Sizes field's options and its default
        orderSizes: preview.orderSizes || [],
        existingRequests: preview.existingRequests || [],
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorText(e, 'Failed to load BOM/Order') }));
    }
  };

  const loadEdit = async () => {
    try {
      const record = await getSampleRequest(id);
      if (!isSrEditable(record.status)) {
        setState((s) => ({ ...s, loading: false, error: 'NOT_EDITABLE', record }));
        return;
      }
      const existingRequests = record.bomId
        ? await bomPreview({ bomId: record.bomId }).then((p) => p.existingRequests || []).catch(() => [])
        : [];
      setState({
        loading: false, error: null, needsPicker: false, mode: 'edit',
        record,
        header: {
          orderNo: record.orderNo, bomId: record.bomId, styleNo: record.styleNo,
          garmentName: record.garmentName, buyerName: record.buyerName,
          buyerCountry: record.buyerCountry, season: record.season, orderQty: record.orderQty ?? null,
          parentSrId: record.parentSrId, parentSrNo: record.parentSrNo, revisionNo: record.revisionNo,
        },
        materials: record.materials || [],
        orderSizes: record.sizes || [],
        existingRequests,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorText(e, 'Failed to load sample request') }));
    }
  };

  useEffect(() => {
    // needsPicker intentionally survives the reload: after the user picks a
    // sample order, the PICKER stays on screen with an inline loading state in
    // its dropdown, and the form renders only once the preview has resolved.
    setState((s) => ({ ...s, loading: true, error: null }));
    if (id) loadEdit(); else loadCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, bomId, orderNo]);

  return state;
};

export default useSampleRequestDraft;
