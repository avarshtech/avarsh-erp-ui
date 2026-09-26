import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { App } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';
import useRequirementSiblings from './useRequirementSiblings';

/**
 * Loads a requirement (or starts a new one) with its order context, the eligible orders
 * and the order's other requirements (CPR WRN-07, GPR OP-2). `config` — { reducer,
 * initialState, newDoc, api: { get, eligibleOrders, orderContext, forOrder }, noun } —
 * must be a module-level constant, since the effects depend on it.
 */
const useRequirementDocument = (id, { reducer, initialState, newDoc, api, noun }) => {
  const { message } = App.useApp();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const siblings = useRequirementSiblings(api.forOrder, state.doc?.orderId, state.doc?.id);

  // After its first save a new requirement moves onto its own URL with the saved document
  // already in state: reloading it would flash the skeleton under the user's next click.
  const heldId = useRef(null);
  useEffect(() => { heldId.current = state.doc?.id ?? null; });

  useEffect(() => {
    if (id && String(id) === String(heldId.current)) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [list, doc] = await Promise.all([api.eligibleOrders(), id ? api.get(id) : newDoc(null)]);
        const order = doc.orderId ? await api.orderContext(doc.orderId) : null;
        if (!alive) return;
        setOrders(list);
        dispatch({ type: 'LOADED', doc, order });
      } catch (e) {
        toastUnlessHandled(message, e, `Could not load the ${noun}`);
        if (alive) dispatch({ type: 'LOAD_FAILED' }); // never leave the previous document on screen
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, message, api, newDoc, noun]);

  const selectOrder = useCallback(async (nextOrderId) => {
    try {
      dispatch({ type: 'ORDER_SELECTED', order: await api.orderContext(nextOrderId) });
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the order');
    }
  }, [api, message]);

  return { ...state, dispatch, loading, orders, siblings, selectOrder };
};

export default useRequirementDocument;
