import { useEffect, useState } from 'react';
import { getInspectedGrnLines } from '../../../services/inventory/inventoryService';

const NONE = new Map();

/**
 * For a new QC: the lines of the picked GRN that already have a QC standing for them, as
 * poLineItemId → QC number, so the line picker can disable them. Empty for a saved QC, whose
 * line is fixed, and until the list arrives (the API refuses a second QC on a line either way).
 */
export default function useInspectedLines(type, grnId, isNew) {
  const [loaded, setLoaded] = useState({ grnId: null, lines: NONE });

  useEffect(() => {
    if (!isNew || !grnId) return undefined;
    let cancelled = false;
    getInspectedGrnLines(type, grnId)
      .then((lines) => { if (!cancelled) setLoaded({ grnId, lines }); })
      .catch(() => { /* the picker stays open; the API refuses a duplicate */ });
    return () => { cancelled = true; };
  }, [type, grnId, isNew]);

  return isNew && loaded.grnId === grnId ? loaded.lines : NONE;
}

/** A picker option for a GRN line, disabled with the QC that covers it when there is one. */
export function lineOption(li, inspected) {
  const value = li.poLineItemId || li.id;
  const label = `${li.variantCode || li.itemCode || '—'} — ${li.variantName || li.description || '—'}`;
  const qcNumber = inspected.get(value);
  return qcNumber ? { label: `${label} (inspected on ${qcNumber})`, value, disabled: true } : { label, value };
}
