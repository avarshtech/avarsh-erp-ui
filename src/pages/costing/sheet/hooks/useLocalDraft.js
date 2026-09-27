import { useCallback, useEffect, useState } from 'react';
import { SECTION_KEYS } from '../model/sectionConfig';
import { hydrateRows } from '../model/rowFactory';
import { isDirty } from '../model/sheetReducer';

const KEY = 'costing-sheet:unsaved-new';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const read = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return saved && Date.now() - saved.at < MAX_AGE_MS ? saved : null;
  } catch {
    return null;
  }
};
const write = (value) => { try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
const remove = () => { try { window.localStorage.removeItem(KEY); } catch { /* blocked */ } };

/**
 * A new, never-saved sheet is kept in this browser as you type, and offered back if the page is
 * closed before the first save. It is not saved to the server until you save it — an abandoned
 * draft there would claim the style (one costing per style).
 */
export default function useLocalDraft({ isNew, form, sheet, dispatch }) {
  const [offer, setOffer] = useState(() => (isNew ? read() : null));

  useEffect(() => {
    if (!isNew || !isDirty(sheet)) return undefined;
    const timer = setTimeout(() => write({
      at: Date.now(),
      values: form.getFieldsValue(true),
      sheet: { sections: sheet.sections, notes: sheet.notes, commercial: sheet.commercial },
    }), 1500);
    return () => clearTimeout(timer);
  }, [isNew, sheet, form]);

  const restore = useCallback(() => {
    if (!offer) return;
    form.setFieldsValue(offer.values);
    const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, hydrateRows(k, offer.sheet.sections?.[k])]));
    dispatch({ type: 'APPLY_SHEET', sheet: { ...offer.sheet, sections } });
    setOffer(null);
  }, [offer, form, dispatch]);

  const discard = useCallback(() => { remove(); setOffer(null); }, []);

  return { offer, restore, discard, clear: remove };
}
