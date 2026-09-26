/**
 * State of the Cut Panel Requirement screen: the CPR document being edited plus the
 * order context it was built from. Pure — every quantity rule lives in utils/cutPanelCalc.
 */
import { highestLineNo, recalcLine, renumberSequences, setSizeQty } from '../../../utils/cutPanelCalc';
import { REQUIREMENT_STATUS } from '../../../utils/requirementStatus';

export const initialCprState = { doc: null, order: null, dirty: false };

/** A fresh Draft for an order: header snapshot, latest approved BOM version, no lines. */
export const newCprDoc = (order) => ({
  id: null, cprNo: null, revisionNo: 0, status: REQUIREMENT_STATUS.DRAFT,
  orderId: order?.id ?? null, orderNo: order?.orderNo ?? null, buyer: order?.buyer ?? null, styleNo: order?.styleNo ?? null,
  bomVersion: order?.latestBomVersion ?? null,
  orderQtySnapshot: order?.totalQty ?? null,
  orderAllowancePct: order?.allowancePercent ?? null,
  remarks: '', lines: [], consumedQty: 0,
});

const mapLine = (state, key, fn) => ({
  ...state,
  dirty: true,
  doc: { ...state.doc, lines: state.doc.lines.map((l) => (l.key === key ? fn(l) : l)) },
});

export const cprReducer = (state, action) => {
  switch (action.type) {
    case 'LOADED':
      return { doc: action.doc, order: action.order, dirty: false };
    case 'LOAD_FAILED':
      return initialCprState;
    case 'ORDER_SELECTED':
      return { doc: newCprDoc(action.order), order: action.order, dirty: true };
    case 'BOM_SELECTED':
      return { ...state, dirty: true, doc: { ...state.doc, bomVersion: action.bomVersion } };
    case 'LINES_ADDED':
      return { ...state, dirty: true, doc: { ...state.doc, lines: [...state.doc.lines, ...action.lines] } };
    case 'LINES_REMOVED': { // lastLineNo remembers the removed keys, so they are never reissued
      const drop = new Set(action.keys);
      const lines = renumberSequences(state.doc.lines.filter((l) => !drop.has(l.key)));
      return { ...state, dirty: true, doc: { ...state.doc, lastLineNo: highestLineNo(state.doc), lines } };
    }
    case 'LINE_PATCHED':
      return mapLine(state, action.key, (l) => ({ ...l, ...action.patch }));
    case 'LINE_ALLOWANCE': // PRD §9.4: changing Allow % recalculates that line only
      return mapLine(state, action.key, (l) => recalcLine({ ...l, allowancePct: action.pct }, state.order));
    case 'LINE_QTY':
      return mapLine(state, action.key, (l) => setSizeQty(l, action.size, action.qty));
    case 'RECALC_ALL': // "Recalculate from Order Qty": clears every manual override
      return {
        ...state,
        dirty: true,
        doc: { ...state.doc, orderQtySnapshot: state.order.totalQty, lines: state.doc.lines.map((l) => recalcLine(l, state.order)) },
      };
    case 'APPLY_ALLOWANCE_ALL': // overridden lines only when the user confirmed including them
      return {
        ...state,
        dirty: true,
        doc: {
          ...state.doc,
          lines: state.doc.lines.map((l) => (l.isManualOverride && !action.includeOverridden
            ? l : recalcLine({ ...l, allowancePct: action.pct }, state.order))),
        },
      };
    case 'SAVED':
      return { ...state, doc: action.doc, dirty: false };
    default:
      return state;
  }
};
