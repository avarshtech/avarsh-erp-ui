import { useCallback, useEffect, useState } from 'react';

/**
 * The order and style a production module is currently working on.
 *
 * The floor works one order at a time, so re-picking it on every screen of a
 * module is pure friction. Each module keeps its own selection — cutting,
 * sewing and finishing are routinely on different orders — and it lives in
 * sessionStorage so it lasts the shift and not beyond it.
 *
 * Screens open on `defaultOrderId` / `defaultCutPoId` and call `selectOrder` /
 * `selectCutPo` when the user changes it; every screen in the module follows,
 * in this tab and any other.
 */
const KEY = (module) => `avarsh-erp-selection-${module}`;
const EVENT = 'avarsh-erp-selection-change';

const read = (module) => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY(module)) || 'null');
  } catch {
    // A tab with storage blocked simply gets no default.
    return null;
  }
};

const useModuleSelection = (module) => {
  const [selection, setSelection] = useState(() => read(module));

  // Other screens in the same module change it too, so follow the broadcast
  // rather than each screen holding its own stale copy.
  useEffect(() => {
    const sync = (e) => { if (!e.detail || e.detail === module) setSelection(read(module)); };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [module]);

  const select = useCallback((next) => {
    try {
      if (next?.orderId) sessionStorage.setItem(KEY(module), JSON.stringify(next));
      else sessionStorage.removeItem(KEY(module));
    } catch { /* storage blocked — the selection just will not persist */ }
    setSelection(next?.orderId ? next : null);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: module }));
  }, [module]);

  const selectOrder = useCallback((order) => select(order && {
    orderId: order.id, orderNo: order.orderNo, styleNo: order.styleNo,
  }), [select]);

  /** Cutting picks a Cut PO, which carries the order and style with it. */
  const selectCutPo = useCallback((po) => select(po && {
    orderId: po.orderId, orderNo: po.orderNo, styleNo: po.styleNo, cutPoId: po.id,
  }), [select]);

  /** The remembered order if it is still one the screen was given, else the first. */
  const defaultOrderId = useCallback((orders) => {
    if (!orders?.length) return null;
    return (orders.find((o) => o.id === selection?.orderId) || orders[0]).id;
  }, [selection]);

  /**
   * The remembered Cut PO, or failing that any Cut PO on the remembered order —
   * a floor that just cut PO-1 of an order expects to land on that order.
   */
  const defaultCutPoId = useCallback((cutPos) => {
    if (!cutPos?.length) return null;
    const match = cutPos.find((p) => p.id === selection?.cutPoId)
      || cutPos.find((p) => p.orderId === selection?.orderId);
    return (match || cutPos[0]).id;
  }, [selection]);

  return { selection, select, selectOrder, selectCutPo, defaultOrderId, defaultCutPoId };
};

export default useModuleSelection;
