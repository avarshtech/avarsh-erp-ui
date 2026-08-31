import { useState, useEffect } from 'react';
import { getBomById, getBomByOrderNo } from '../../services/bom/bomService';
import { getOrderByOrderNo } from '../../services/orders/orderService';
import { getBuyerById } from '../../services/master/buyerService';
import { getSampleRequest } from '../../services/sr/srService';
import { buildMaterialsFromBom } from '../../utils/sampleBomMapper';
import { isSrEditable } from '../../utils/sampleRequestConstants';

/**
 * Resolves the initial draft for the SR form's three entry modes:
 *  - new from BOM  (?bomId=&orderNo= — the BOMView "Raise Sample Request" path):
 *    loads the REAL BOM + Order so auto-population uses live data
 *  - new bare      → needsPicker (BOM picker — any BOM, sample or bulk)
 *  - edit /:id     → mock record; only Draft SRs are editable
 * Buyer country (overseas invoice gate) comes from the buyer's shipping
 * locations — the Buyer entity itself has no country field.
 */
const resolveBuyerCountry = async (buyerId) => {
  if (!buyerId) return null;
  try {
    const buyer = await getBuyerById(buyerId);
    const data = buyer?.data || buyer;
    const locations = data?.shippingLocations || data?.locations || [];
    return locations[0]?.country || data?.country || null;
  } catch {
    return null;
  }
};

const orderSizesOf = (order) => {
  const sizes = new Set();
  (order?.orderLines || []).forEach((l) => (l.sizes || []).forEach((s) => sizes.add(s)));
  return [...sizes];
};

const useSampleRequestDraft = ({ id, bomId, orderNo }) => {
  const [state, setState] = useState({
    loading: true, error: null, needsPicker: false,
    mode: id ? 'edit' : 'create',
    record: null, header: null, materials: [], orderSizes: [],
  });

  const loadFromBom = async (bom, order) => {
    const buyerCountry = await resolveBuyerCountry(order?.buyerId);
    return {
      loading: false,
      error: null,
      needsPicker: false,
      mode: 'create',
      record: null,
      header: {
        orderNo: order?.orderNo || bom?.orderNo,
        bomId: bom?.id ?? null,
        styleNo: order?.styleNo || bom?.styleName || '',
        garmentName: order?.garmentName || bom?.garmentName || order?.garmentType || '',
        buyerName: order?.buyerName || bom?.buyerName || '',
        buyerCountry,
        season: order?.season || bom?.season || '',
        orderQty: order?.totalOrderQty ?? bom?.orderQty ?? null,
      },
      materials: buildMaterialsFromBom(bom),
      orderSizes: orderSizesOf(order),
    };
  };

  const loadCreate = async () => {
    if (!bomId && !orderNo) {
      setState((s) => ({ ...s, loading: false, needsPicker: true }));
      return;
    }
    try {
      const [bom, order] = await Promise.all([
        bomId ? getBomById(bomId) : getBomByOrderNo(orderNo),
        orderNo ? getOrderByOrderNo(orderNo) : Promise.resolve(null),
      ]);
      const resolvedOrder = order || (bom?.orderNo ? await getOrderByOrderNo(bom.orderNo) : null);
      setState(await loadFromBom(bom, resolvedOrder));
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'Failed to load BOM/Order' }));
    }
  };

  const loadEdit = async () => {
    try {
      const record = await getSampleRequest(id);
      if (!isSrEditable(record.status)) {
        setState((s) => ({ ...s, loading: false, error: 'NOT_EDITABLE', record }));
        return;
      }
      setState({
        loading: false, error: null, needsPicker: false, mode: 'edit',
        record,
        header: {
          orderNo: record.orderNo, bomId: record.bomId, styleNo: record.styleNo,
          garmentName: record.garmentName, buyerName: record.buyerName,
          buyerCountry: record.buyerCountry, season: record.season, orderQty: record.orderQty ?? null,
        },
        materials: record.materials || [],
        orderSizes: record.sizes || [],
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'Failed to load sample request' }));
    }
  };

  useEffect(() => {
    // needsPicker intentionally survives the reload: after the user picks a
    // sample order, the PICKER stays on screen with an inline loading state in
    // its dropdown, and the form renders only once BOM + Order have resolved.
    setState((s) => ({ ...s, loading: true, error: null }));
    if (id) loadEdit(); else loadCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, bomId, orderNo]);

  return state;
};

export default useSampleRequestDraft;
