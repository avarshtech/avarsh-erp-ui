import { useCallback, useEffect, useReducer, useState } from 'react';
import { App } from 'antd';
import {
  getGpr, getGprEligibleOrders, getGprOrderContext, getGprsForOrder,
} from '../../../services/bom/garmentProcess/garmentProcessService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { gprReducer, initialGprState, newGprDoc } from './gprReducer';

/**
 * Loads a Garment Process Requirement (or starts a new one) with its order context,
 * the eligible orders and the order's other open requirements (PRD OP-2).
 */
const useGarmentProcessRequirement = (id) => {
  const { message } = App.useApp();
  const [state, dispatch] = useReducer(gprReducer, initialGprState);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [siblings, setSiblings] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [list, doc] = await Promise.all([getGprEligibleOrders(), id ? getGpr(id) : Promise.resolve(newGprDoc(null))]);
        const order = doc.orderId ? await getGprOrderContext(doc.orderId) : null;
        if (!alive) return;
        setOrders(list);
        dispatch({ type: 'LOADED', doc, order });
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not load the garment process requirement');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, message]);

  const orderId = state.doc?.orderId;
  const docId = state.doc?.id;
  useEffect(() => {
    if (!orderId) { setSiblings([]); return; }
    getGprsForOrder(orderId, docId).then(setSiblings).catch(() => setSiblings([]));
  }, [orderId, docId]);

  const selectOrder = useCallback(async (nextOrderId) => {
    try {
      dispatch({ type: 'ORDER_SELECTED', order: await getGprOrderContext(nextOrderId) });
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the order');
    }
  }, [message]);

  return { ...state, dispatch, loading, orders, siblings, selectOrder };
};

export default useGarmentProcessRequirement;
