import dayjs from 'dayjs';
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

/**
 * Screen state of a Garment Process PO: the document, whether it has unsaved changes, and
 * the line rows ticked for "apply to selected lines". The requirement picker (section ②)
 * keeps its own ticks.
 */
export const initialGpoState = { doc: null, dirty: false, selectedKeys: [] };

export const newGpoDoc = () => ({
  id: null, type: 'GPO', poNo: null, status: S.DRAFT, poDate: dayjs().format('YYYY-MM-DD'), currency: 'INR',
  branchId: null, branchName: null, vendor: null, paymentTerms: null, deliveryTerms: '', requiredDate: null,
  process: null, returnTo: 'FINISHING', returnToOther: '', plannedSendDate: null, expectedReturnDate: null,
  instructions: '', remarks: '', discountType: 'AMOUNT', discountValue: 0, otherCharges: 0,
  lines: [], overrides: [], approvals: [], lastLineNo: 0,
});

const lineNo = (key) => Number(String(key).replace(/\D/g, '')) || 0;

/** Next line number — never reissued after a removal, since an excess points at its line key. */
export const nextLineNo = (doc) => doc.lines.reduce((m, l) => Math.max(m, lineNo(l.key)), doc.lastLineNo || 0) + 1;

const withLines = (state, fn) => ({ ...state, dirty: true, doc: { ...state.doc, lines: fn(state.doc.lines) } });

export const gpoReducer = (state, action) => {
  switch (action.type) {
    case 'LOADED':
    case 'SAVED':
      return { ...initialGpoState, doc: action.doc, selectedKeys: action.type === 'SAVED' ? state.selectedKeys : [] };
    case 'LOAD_FAILED':
      return initialGpoState;
    case 'PATCH': // header, vendor, delivery, remarks, commercial
      return { ...state, dirty: true, doc: { ...state.doc, ...action.patch } };
    case 'LINES_ADDED': // the first lines fix the PO's process (one per PO, deviation D23); `header` fills defaults
      return {
        ...state, dirty: true,
        doc: {
          ...state.doc, ...action.header, lines: [...state.doc.lines, ...action.lines],
          process: state.doc.lines.length ? state.doc.process : action.process,
          instructions: state.doc.instructions || action.process?.defaultInstructions || '',
        },
      };
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
