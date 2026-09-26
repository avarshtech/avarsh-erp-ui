import { useCallback, useEffect, useReducer, useState } from 'react';
import { App } from 'antd';
import {
  getCpr, getCprEligibleOrders, getCprOrderContext, getCprsForOrder,
} from '../../../services/bom/cutPanel/cutPanelService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { cprReducer, initialCprState, newCprDoc } from './cprReducer';

/**
 * Loads a Cut Panel Requirement (or starts a new one) with its order context, the
 * eligible orders (new only) and the order's other requirements (WRN-07).
 */
const useCutPanelRequirement = (id) => {
  const { message } = App.useApp();
  const [state, dispatch] = useReducer(cprReducer, initialCprState);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [siblings, setSiblings] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (id) {
          const doc = await getCpr(id);
          const order = await getCprOrderContext(doc.orderId);
          if (alive) dispatch({ type: 'LOADED', doc, order });
        } else {
          const list = await getCprEligibleOrders();
          if (!alive) return;
          setOrders(list);
          dispatch({ type: 'LOADED', doc: newCprDoc(null), order: null });
        }
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not load the cut panel requirement');
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
    getCprsForOrder(orderId, docId).then(setSiblings).catch(() => setSiblings([]));
  }, [orderId, docId]);

  const selectOrder = useCallback(async (nextOrderId) => {
    try {
      dispatch({ type: 'ORDER_SELECTED', order: await getCprOrderContext(nextOrderId) });
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the order');
    }
  }, [message]);

  return { ...state, dispatch, loading, orders, siblings, selectOrder };
};

export default useCutPanelRequirement;
