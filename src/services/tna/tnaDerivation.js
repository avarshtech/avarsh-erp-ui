/**
 * Activity derivation — CR-TNA-001 FR-2. An order's activity set is derived from its own
 * source records, never from a fixed template:
 *  - core activities from the governed master, kept only where their applicability holds;
 *  - one dispatch + approval pair per sample cycle — a rejection opens a new cycle (FR-5.10);
 *  - one activity per Cut Panel / Garment Process requirement step, in the recorded sequence,
 *    carrying that step's own colours, panels and quantity (FR-2.3/2.4/2.5);
 *  - inapplicable activities are omitted, not zero-length, and their predecessors are
 *    re-linked to their successors so the graph stays connected (FR-2.6/2.8);
 *  - steps of a requirement still in Draft are provisional (FR-1.6).
 * Durations resolve by precedence (FR-3.3). Tier 1 (an order-specific duration on the source
 * requirement) has no field in the ERP's requirements today, so tiers 2–4 apply.
 */
export const CUT_PANEL_END = '@CUT_PANEL';
export const GARMENT_PROCESS_END = '@GARMENT_PROCESS';

export const SAMPLE_KEY = {
  'Lab Dip': 'LAB_DIP', 'Strike Off': 'LAB_DIP', Fit: 'FIT', 'First Bulk Piece': 'FBP', 'PP Sample': 'PP',
};

const pad = (n) => String(n).padStart(2, '0');

/** FR-3.3 — buyer + product type, then product type, then the global master default. */
export const resolveDuration = (code, base, overrides, { buyer, productType }) => {
  const exact = overrides.find((o) => o.activityCode === code && o.buyer === buyer && o.productType === productType);
  if (exact) return { duration: exact.duration, durationSource: 'BUYER_PRODUCT_TYPE' };
  const byType = overrides.find((o) => o.activityCode === code && !o.buyer && o.productType === productType);
  if (byType) return { duration: byType.duration, durationSource: 'PRODUCT_TYPE' };
  return { duration: base, durationSource: 'GLOBAL' };
};

const applies = (a, snap) => {
  const ap = a.applicability;
  if (ap.type === 'SAMPLE') return snap.samples.some((s) => ap.sampleTypes.includes(s.sampleType));
  if (ap.type === 'FLAG') return !!snap.flags?.[ap.flag];
  return true;
};

const cyclesOf = (snap, key) => Math.max(1, ...snap.samples.filter((s) => SAMPLE_KEY[s.sampleType] === key).map((s) => s.cycles || 1));

/** Each re-make is its own request (parent SR → revision n), so each cycle has its own record. */
const sampleRefOf = (snap, key, cycle) => {
  const s = snap.samples.find((x) => SAMPLE_KEY[x.sampleType] === key);
  return s && ((s.cycleRefs && s.cycleRefs[cycle - 1]) || (cycle > 1 ? `${s.ref}/R${cycle - 1}` : s.ref));
};

/** One activity per requirement step (lines grouped by sequence), chained after `first`. */
const processActivities = (req, kind, first, catalogue) => {
  if (!req || !req.lines?.length) return [];
  const prefix = kind === 'CUT_PANEL' ? 'C' : 'G';
  const bySeq = new Map();
  req.lines.forEach((l) => { if (!bySeq.has(l.seq)) bySeq.set(l.seq, []); bySeq.get(l.seq).push(l); });
  let prev = first;
  return [...bySeq.keys()].sort((x, y) => x - y).map((seq) => {
    const lines = bySeq.get(seq);
    const process = lines[0].process;
    const code = `${prefix}${pad(seq)}`;
    const act = {
      code,
      masterCode: code,
      name: process,
      shortName: process.replace(/^(Panel|Garment) /, ''),
      lane: kind === 'CUT_PANEL' ? 'CUTTING' : 'SEWING',
      sourceModule: kind === 'CUT_PANEL' ? 'Cut Panel' : 'Garment Process',
      sourceScreen: kind === 'CUT_PANEL' ? 'Cut Panel requirement' : 'Garment Process requirement',
      completionEvent: kind === 'CUT_PANEL' ? 'panel.receipt_accepted' : 'process.receipt_accepted',
      eventNote: 'Accepted receipt of processed goods reaches the threshold — not PO allocation, not "Fully Used"',
      threshold: catalogue.threshold,
      applicability: { type: 'ROUTE', label: `Route contains ${process}` },
      baseDuration: catalogue[kind][process] ?? catalogue[kind].default,
      dayType: 'WD',
      isGate: false,
      attribution: 'SUBCONTRACTOR',
      predecessors: [prev],
      sourceStatus: 'LIVE',
      requirementRef: req.ref,
      provisional: req.status === 'DRAFT',
      scope: {
        seq,
        colours: [...new Set(lines.flatMap((l) => l.colours))],
        panels: [...new Set(lines.map((l) => l.panel).filter(Boolean))],
        lines: lines.map((l) => ({ lineKey: l.lineKey, panel: l.panel, colours: l.colours, qty: l.qty })),
      },
      requiredQty: lines.reduce((s, l) => s + l.qty, 0),
      uom: 'pcs',
    };
    prev = code;
    return act;
  });
};

/**
 * Expand each sample's dispatch (+ approval) into one pair per cycle (FR-2.9, FR-5.10).
 * Cycle i+1's dispatch follows cycle i's outcome; whatever waited on the sample's cycle-1
 * terminal now waits on its final cycle, so every cycle counts toward elapsed time (FR-7.14).
 */
const expandCycles = (acts, snap) => {
  const added = {};
  const finalTerminal = {};
  [...new Set(acts.filter((a) => a.sampleKey).map((a) => a.sampleKey))].forEach((key) => {
    const dispatch = acts.find((a) => a.sampleKey === key && a.sampleStage === 'DISPATCH');
    const approval = acts.find((a) => a.sampleKey === key && a.sampleStage === 'APPROVAL');
    const first = (approval || dispatch).code;
    const list = [];
    let prev = first;
    for (let i = 2; i <= cyclesOf(snap, key); i += 1) {
      const dCode = `${dispatch.code}-${i}`;
      list.push({ ...dispatch, code: dCode, cycle: i, name: `${dispatch.name} — cycle ${i}`, predecessors: [prev] });
      prev = dCode;
      if (approval) {
        const aCode = `${approval.code}-${i}`;
        list.push({ ...approval, code: aCode, cycle: i, name: `${approval.name} — cycle ${i}`, predecessors: [dCode] });
        prev = aCode;
      }
    }
    added[first] = list;
    finalTerminal[first] = prev;
  });
  return acts.flatMap((a) => [
    { ...a, cycle: a.sampleKey ? 1 : undefined, predecessors: a.predecessors.map((p) => finalTerminal[p] || p) },
    ...(added[a.code] || []),
  ]);
};

/**
 * Derive the order's activity set from its source snapshot.
 * snapshot: { samples: [{sampleType, ref, cycles}], cutPanel, garmentProcess, flags,
 *             orderQty, fabricRequired, fabricUom }
 * master:   { activities, processSteps, overrides }, keys: { buyer, productType }
 */
export const deriveActivities = (snapshot, master, keys) => {
  const core = master.activities.map((a) => ({ ...a, masterCode: a.code, baseDuration: a.duration }));
  const cut = processActivities(snapshot.cutPanel, 'CUT_PANEL', 'A17', master.processSteps);
  const garment = processActivities(snapshot.garmentProcess, 'GARMENT_PROCESS', 'A20', master.processSteps);
  const virtualPreds = {
    [CUT_PANEL_END]: [cut.length ? cut[cut.length - 1].code : 'A17'],
    [GARMENT_PROCESS_END]: [garment.length ? garment[garment.length - 1].code : 'A20'],
  };
  const ordered = core.flatMap((a) => (a.code === 'A17' ? [a, ...cut] : a.code === 'A20' ? [a, ...garment] : [a]));
  const removed = new Set(ordered.filter((a) => !applies(a, snapshot)).map((a) => a.code));
  Object.keys(virtualPreds).forEach((v) => removed.add(v));
  const byCode = Object.fromEntries(ordered.map((a) => [a.code, a]));
  const resolve = (code) => (removed.has(code) ? (byCode[code]?.predecessors ?? virtualPreds[code]).flatMap(resolve) : [code]);
  const kept = ordered
    .filter((a) => !removed.has(a.code))
    .map((a) => ({ ...a, predecessors: [...new Set(a.predecessors.flatMap(resolve))] }));

  return expandCycles(kept, snapshot).map((a) => {
    const { duration, durationSource } = resolveDuration(a.masterCode, a.baseDuration, master.overrides, keys);
    const qty = a.qtyKey === 'fabric'
      ? { requiredQty: snapshot.fabricRequired, uom: snapshot.fabricUom || 'm' }
      : a.qtyKey === 'order' ? { requiredQty: snapshot.orderQty, uom: 'pcs' } : {};
    return {
      ...a,
      ...qty,
      duration,
      durationSource,
      applicabilityLabel: a.applicability.label,
      provisional: !!a.provisional,
      sampleRef: a.sampleKey ? sampleRefOf(snapshot, a.sampleKey, a.cycle) : undefined,
    };
  });
};
