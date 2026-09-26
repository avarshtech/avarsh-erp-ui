/**
 * State of the Garment Process Requirement screen: the GPR being edited, its order
 * context and the active process line. Pure — quantity rules live in utils/garmentProcessCalc.
 */
import {
  copyFromPrevious, ensureSelectedCells, moveGprLine, newGprLine, renumberGprLines, resetToOrderQty,
} from '../../../utils/garmentProcessCalc';
import { REQUIREMENT_STATUS } from '../../../utils/requirementStatus';

export const initialGprState = { doc: null, order: null, activeKey: null, dirty: false };

/** Monotonic line keys — never Date.now(). */
const nextKey = (lines) => `G${lines.reduce((m, l) => Math.max(m, Number(String(l.key).replace(/\D/g, '')) || 0), 0) + 1}`;

/** A fresh Draft: the order header plus one line with every colour and size selected (PRD §5). */
export const newGprDoc = (order) => ({
  id: null, requirementNo: null, status: REQUIREMENT_STATUS.DRAFT,
  orderId: order?.id ?? null, orderNo: order?.orderNo ?? null, buyer: order?.buyer ?? null, styleNo: order?.styleNo ?? null,
  remarks: '', consumedQty: 0,
  lines: order ? [newGprLine(order, 'G1', 1)] : [],
});

const withLines = (state, lines, activeKey = state.activeKey) => ({ ...state, dirty: true, activeKey, doc: { ...state.doc, lines } });
const mapLine = (state, key, fn) => withLines(state, state.doc.lines.map((l) => (l.key === key ? fn(l) : l)));

export const gprReducer = (state, action) => {
  const { doc, order } = state;
  switch (action.type) {
    case 'LOADED':
      return { doc: action.doc, order: action.order, activeKey: action.doc.lines[0]?.key ?? null, dirty: false };
    case 'ORDER_SELECTED': {
      const fresh = newGprDoc(action.order);
      return { doc: fresh, order: action.order, activeKey: fresh.lines[0].key, dirty: true };
    }
    case 'LINE_ADDED': {
      const line = newGprLine(order, nextKey(doc.lines), doc.lines.length + 1);
      return withLines(state, [...doc.lines, line], line.key);
    }
    case 'LINE_SELECTED':
      return { ...state, activeKey: action.key };
    case 'LINE_MOVED': {
      const idx = doc.lines.findIndex((l) => l.key === action.key);
      return withLines(state, moveGprLine(doc.lines, idx, action.delta), action.key);
    }
    case 'LINE_REMOVED': {
      const idx = doc.lines.findIndex((l) => l.key === action.key);
      const lines = renumberGprLines(doc.lines.filter((l) => l.key !== action.key));
      return withLines(state, lines, lines[Math.min(idx, lines.length - 1)]?.key ?? null);
    }
    case 'LINE_PATCHED': // colours / sizes / process; newly selected cells start at order qty
      return mapLine(state, action.key, (l) => ensureSelectedCells({ ...l, ...action.patch }, order));
    case 'CELL_QTY':
      return mapLine(state, action.key, (l) => ({ ...l, qty: { ...l.qty, [action.color]: { ...l.qty[action.color], [action.size]: action.qty } } }));
    case 'OVER_REASON':
      return mapLine(state, action.key, (l) => ({ ...l, overQtyReasons: { ...l.overQtyReasons, [action.cell]: action.reason } }));
    case 'COPY_PREVIOUS':
      return withLines(state, copyFromPrevious(doc.lines, doc.lines.findIndex((l) => l.key === action.key)));
    case 'RESET_QTY':
      return mapLine(state, action.key, (l) => resetToOrderQty(l, order));
    case 'REMARKS':
      return { ...state, dirty: true, doc: { ...doc, remarks: action.text } };
    case 'SAVED':
      return {
        ...state,
        dirty: false,
        doc: action.doc,
        activeKey: action.doc.lines.some((l) => l.key === state.activeKey) ? state.activeKey : action.doc.lines[0]?.key ?? null,
      };
    default:
      return state;
  }
};
