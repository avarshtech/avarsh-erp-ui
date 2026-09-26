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

const orderHeader = (order) => ({
  orderId: order?.id ?? null, orderNo: order?.orderNo ?? null, buyer: order?.buyer ?? null, styleNo: order?.styleNo ?? null,
});

/** A fresh Draft: the order header plus one line with every colour and size selected (PRD §5). */
export const newGprDoc = (order) => ({
  id: null, requirementNo: null, status: REQUIREMENT_STATUS.DRAFT, ...orderHeader(order),
  remarks: '', consumedQty: 0,
  lines: order ? [newGprLine(order, 'G1', 1)] : [],
});

/** A save stores only the selected cells; the typed quantities of deselected ones stay for the session. */
const keepTyped = (typed = {}, saved = {}) => Object.fromEntries(
  [...new Set([...Object.keys(typed), ...Object.keys(saved)])].map((c) => [c, { ...typed[c], ...saved[c] }]),
);

const withLines = (state, lines, activeKey = state.activeKey) => ({ ...state, dirty: true, activeKey, doc: { ...state.doc, lines } });
const mapLine = (state, key, fn) => withLines(state, state.doc.lines.map((l) => (l.key === key ? fn(l) : l)));

export const gprReducer = (state, action) => {
  const { doc, order } = state;
  switch (action.type) {
    case 'LOADED':
      return { doc: action.doc, order: action.order, activeKey: action.doc.lines[0]?.key ?? null, dirty: false };
    case 'LOAD_FAILED':
      return initialGprState;
    case 'ORDER_SELECTED': { // the lines restart for the new order; a saved draft keeps its number and version
      const lines = [newGprLine(action.order, 'G1', 1)];
      return { doc: { ...(doc || newGprDoc(null)), ...orderHeader(action.order), lines }, order: action.order, activeKey: 'G1', dirty: true };
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
    case 'LINE_REMOVED': { // the editor stays on its line unless that line was removed
      const idx = doc.lines.findIndex((l) => l.key === action.key);
      const lines = renumberGprLines(doc.lines.filter((l) => l.key !== action.key));
      const activeKey = action.key === state.activeKey ? lines[Math.min(idx, lines.length - 1)]?.key ?? null : state.activeKey;
      return withLines(state, lines, activeKey);
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
    case 'SAVED': { // reselecting a colour or size after a save restores what was typed (PRD)
      const typed = Object.fromEntries((doc?.lines || []).map((l) => [l.key, l.qty]));
      const lines = action.doc.lines.map((l) => (typed[l.key] ? { ...l, qty: keepTyped(typed[l.key], l.qty) } : l));
      return {
        ...state,
        dirty: false,
        doc: { ...action.doc, lines },
        activeKey: lines.some((l) => l.key === state.activeKey) ? state.activeKey : lines[0]?.key ?? null,
      };
    }
    default:
      return state;
  }
};
