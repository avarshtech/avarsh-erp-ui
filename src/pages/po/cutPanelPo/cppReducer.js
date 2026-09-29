/**
 * State of the Cut Panel PO screen. Pure — rules live in utils/cutPanelPoCalc.
 *
 *   doc           the PO as saved, or the draft being built
 *   rev           working copy of an open amendment (draft) — the grid and value block
 *                 edit it instead of doc, which stays the live revision
 *   selection     the requirement picker before Add to Grid (PRD §8.2)
 *   selectedKeys  grid rows ticked for "apply to selected lines"
 */
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

const EMPTY_SELECTION = { cprIds: [], colours: [], sizes: [] };

/** `dirty`: anything unsaved; `docDirty`: unsaved edits to the live PO itself (not to an open amendment). */
export const initialCppState = { doc: null, rev: null, dirty: false, docDirty: false, selection: EMPTY_SELECTION, selectedKeys: [] };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A fresh draft (PRD §11.1 defaults): today, INR, back to Cutting; the return unit is picked. */
export const newCppDoc = () => ({
  id: null, type: 'CPP', poNo: null, status: S.DRAFT, poDate: today(), currency: 'INR', branchId: null, branchName: null,
  process: null, vendor: null, paymentTerms: null, requiredDeliveryDate: null,
  returnTo: 'CUTTING', returnToOther: '', returnUnitId: null, returnUnitName: null, returnUnitAddress: null, instructions: '',
  otherCharges: 0, lateDeliveryReason: '', duplicateReason: '',
  lines: [], overrides: [], approvals: [], revisionNo: 0, pendingRevision: null, revisions: [], lastLineNo: 0,
});

const lineNo = (key) => Number(String(key).replace(/\D/g, '')) || 0;

/** Next line number — never reissued after a removal, since overrides point at line keys. */
export const nextLineNo = (doc) => doc.lines.reduce((m, l) => Math.max(m, lineNo(l.key)), doc.lastLineNo || 0) + 1;

const draftRevision = (doc) => (doc.pendingRevision?.status === S.DRAFT ? JSON.parse(JSON.stringify(doc.pendingRevision)) : null);

const target = (state) => (state.rev ? 'rev' : 'doc');

const withLines = (state, fn) => {
  const t = target(state);
  return { ...state, dirty: true, docDirty: state.docDirty || t === 'doc', [t]: { ...state[t], lines: fn(state[t].lines) } };
};

export const cppReducer = (state, action) => {
  switch (action.type) {
    case 'LOADED':
    case 'SAVED':
      return { ...initialCppState, doc: action.doc, rev: draftRevision(action.doc), selectedKeys: action.type === 'SAVED' ? state.selectedKeys : [] };
    case 'LOAD_FAILED':
      return initialCppState;
    case 'PATCH': // header, vendor, delivery instructions
      return { ...state, dirty: true, docDirty: true, doc: { ...state.doc, ...action.patch } };
    case 'COMMERCIAL': // other charges and amendable dates / terms: the amendment's while one is open
      return { ...state, dirty: true, docDirty: state.docDirty || !state.rev, [target(state)]: { ...state[target(state)], ...action.patch } };
    case 'PROCESS_SELECTED':
      return {
        ...state, dirty: true, selection: EMPTY_SELECTION,
        doc: { ...state.doc, process: action.process, instructions: state.doc.instructions || action.process?.defaultInstructions || '' },
      };
    case 'SELECTION':
      return { ...state, selection: { ...state.selection, ...action.patch } };
    case 'LINES_ADDED':
      return { ...withLines(state, (lines) => [...lines, ...action.lines]), selection: EMPTY_SELECTION };
    case 'LINE_PATCH':
      return withLines(state, (lines) => lines.map((l) => (l.key === action.key ? { ...l, ...action.patch } : l)));
    case 'LINES_SET':
      return withLines(state, () => action.lines);
    case 'LINES_REMOVED': {
      const keys = new Set(action.keys);
      const next = withLines(state, (lines) => lines.filter((l) => !keys.has(l.key)));
      return { ...next, doc: { ...next.doc, lastLineNo: nextLineNo(state.doc) - 1 }, selectedKeys: state.selectedKeys.filter((k) => !keys.has(k)) };
    }
    case 'ROWS_SELECTED':
      return { ...state, selectedKeys: action.keys };
    default:
      return state;
  }
};
