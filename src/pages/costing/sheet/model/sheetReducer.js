import { SECTION_CONFIG, SECTION_KEYS } from './sectionConfig';
import { blankRow, nextKey, recalcRow } from './rowFactory';

/**
 * Everything on the sheet below the header: the five row sections, the section notes and the
 * commercial inputs. The header lives in the AntD Form; this is the rest.
 *
 * Unsaved state is a revision count, not a flag: every change bumps `rev`, a save records the
 * `rev` it sent, and the sheet is dirty while `rev !== savedRev`. An autosave that returns
 * while the user kept typing therefore cannot mark the newer edits as saved.
 *
 * Bulk changes (templates, imports, AI, the Genie, a delete) push an undo snapshot first, so any
 * of them can be taken back with one click. Keystrokes do not — undo is for batches. A batch of
 * several changes dispatches CHECKPOINT once and then its changes with skipUndo.
 */
const UNDO_LIMIT = 20;

export const emptySections = () => Object.fromEntries(SECTION_KEYS.map((k) => [k, []]));

export const initialSheet = () => ({
  sections: emptySections(),
  notes: { fabric: '', trims: '', manufacturing: '', overhead: '' },
  commercial: { agentCommissionPct: 0, profitPct: 0, targetPrice: '', perSizeOverrides: {}, syncPercentages: true },
  rev: 0,
  savedRev: 0,
  undo: [],
  highlight: [],
});

export const isDirty = (sheet) => sheet.rev !== sheet.savedRev;

const snapshot = (s) => ({ sections: s.sections, notes: s.notes, commercial: s.commercial });
const pushUndo = (s) => [...s.undo, snapshot(s)].slice(-UNDO_LIMIT);
const mapSection = (s, key, fn) => ({ ...s.sections, [key]: fn(s.sections[key]) });

function reduce(state, action) {
  switch (action.type) {
    case 'ADD_ROW':
      return { ...state, sections: mapSection(state, action.section, (rows) => [...rows, action.row || blankRow(action.section)]) };
    case 'UPDATE_ROW':
      return {
        ...state,
        sections: mapSection(state, action.section, (rows) => rows.map((r) =>
          (r.key === action.key ? recalcRow(action.section, { ...r, ...action.patch }) : r))),
      };
    case 'REMOVE_ROW':
      return { ...state, undo: action.skipUndo ? state.undo : pushUndo(state), sections: mapSection(state, action.section, (rows) => rows.filter((r) => r.key !== action.key)) };
    case 'DUPLICATE_ROW':
      return {
        ...state,
        sections: mapSection(state, action.section, (rows) => rows.flatMap((r) =>
          (r.key === action.key ? [r, { ...r, key: nextKey(SECTION_CONFIG[action.section].prefix) }] : [r]))),
      };
    case 'REPLACE_ROW':
      // One row becomes several (the AI consumption calculator's per-size split).
      return { ...state, sections: mapSection(state, action.section, (rows) => rows.flatMap((r) => (r.key === action.key ? action.rows : [r]))) };
    case 'APPLY_ROWS': {
      // { rows: { fabric: [...], ... }, mode: 'append' | 'replace' } — rows already hydrated.
      const sections = { ...state.sections };
      Object.entries(action.rows || {}).forEach(([key, rows]) => {
        if (rows?.length) sections[key] = action.mode === 'replace' ? rows : [...sections[key], ...rows];
      });
      return {
        ...state, undo: action.skipUndo ? state.undo : pushUndo(state), sections,
        highlight: Object.values(action.rows || {}).flat().map((r) => r.key),
      };
    }
    case 'APPLY_SHEET':
      // A whole sheet's body at once (copy of a previous costing), still undoable.
      return { ...state, undo: pushUndo(state), ...action.sheet, highlight: Object.values(action.sheet.sections || {}).flat().map((r) => r.key) };
    case 'SET_NOTE':
      return { ...state, notes: { ...state.notes, [action.note]: action.value } };
    case 'SET_COMMERCIAL':
      return { ...state, commercial: { ...state.commercial, ...action.patch } };
    case 'SET_SIZE_OVERRIDE': {
      const overrides = state.commercial.perSizeOverrides;
      return {
        ...state,
        commercial: { ...state.commercial, perSizeOverrides: { ...overrides, [action.size]: { ...overrides[action.size], ...action.patch } } },
      };
    }
    case 'UNDO': {
      if (!state.undo.length) return state;
      return { ...state, ...state.undo[state.undo.length - 1], undo: state.undo.slice(0, -1), highlight: [] };
    }
    case 'MARK_DIRTY':
      return { ...state };
    default:
      return state;
  }
}

export function sheetReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...initialSheet(), ...action.sheet };
    case 'MARK_SAVED':
      return { ...state, savedRev: Math.max(state.savedRev, action.rev) };
    case 'CHECKPOINT':
      // One undo step for a batch of changes that follows (the Help Genie's), which then pass
      // skipUndo. Not an edit in itself, so the sheet does not turn dirty.
      return { ...state, undo: pushUndo(state) };
    case 'CLEAR_HIGHLIGHT':
      return state.highlight.length ? { ...state, highlight: [] } : state;
    default: {
      const next = reduce(state, action);
      return next === state ? state : { ...next, rev: state.rev + 1 };
    }
  }
}
