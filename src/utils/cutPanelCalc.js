/**
 * Cut Panel Requirement calculations — pure functions, no React.
 *
 * A requirement LINE is one Fabric + Colour + Panel + Process with a sequence number
 * and a size-wise quantity:
 *   { key, fabricId, fabricCode, fabricName, bomConsumption,
 *     colorName, colorCode, colorHex, panelId, panelName, panelsPerGarment,
 *     processId, processName, processOtherName, sequenceNo, allowancePct,
 *     sizes: { [size]: { baseQty, calculatedQty, requiredQty } },
 *     isManualOverride, varianceReason }
 *
 * PRD §9.1: Required Qty (size) = ROUNDUP(Base Qty x Panels per Garment x (1 + Allowance% / 100))
 */
import { CPR_VAL, OTHER_PROCESS_NAME } from './cutPanelConstants';

/** Strips float noise first so 100 x 1.1 (= 110.00000000000001) does not round up to 111. */
const round6 = (n) => Math.round(n * 1e6) / 1e6;

export const calcRequiredQty = (baseQty, panelsPerGarment, allowancePct) => {
  if (!(baseQty > 0)) return 0;
  return Math.ceil(round6(baseQty * (panelsPerGarment || 1) * (1 + (Number(allowancePct) || 0) / 100)));
};

export const processLabel = (line) =>
  (line.processName === OTHER_PROCESS_NAME && line.processOtherName ? line.processOtherName : line.processName);

/** Sequence scope (PRD §8.2.2): Fabric + Colour + Panel. */
export const sequenceGroupKey = (line) => `${line.fabricId}|${line.colorName}|${line.panelName}`;

/** Uniqueness (BR-05): Fabric + Colour + Panel + Process — the "Other" text counts as the process. */
export const duplicateKey = (line) => `${sequenceGroupKey(line)}|${processLabel(line)}`.toLowerCase();

export const sizeCells = (order, colorName, panelsPerGarment, allowancePct) =>
  Object.fromEntries(order.sizes.map((size) => {
    const baseQty = order.qtyMatrix[colorName]?.[size] || 0;
    const calculatedQty = calcRequiredQty(baseQty, panelsPerGarment, allowancePct);
    return [size, { baseQty, calculatedQty, requiredQty: calculatedQty }];
  }));

export const lineTotal = (line) =>
  Object.values(line.sizes).reduce((s, c) => s + (Number(c.requiredQty) || 0), 0);

export const lineCalculatedTotal = (line) =>
  Object.values(line.sizes).reduce((s, c) => s + (c.calculatedQty || 0), 0);

export const varianceOf = (line) => lineTotal(line) - lineCalculatedTotal(line);

/** WRN-01/02 (quantity) or WRN-04 (allowance) — both need a reason before Submit. */
export const lineWarnings = (line, orderAllowancePct) => {
  const v = varianceOf(line);
  const out = [];
  if (v > 0) out.push('WRN_01');
  if (v < 0) out.push('WRN_02');
  if (Number(line.allowancePct) !== Number(orderAllowancePct)) out.push('WRN_04');
  return out;
};

export const needsReason = (line, orderAllowancePct) => lineWarnings(line, orderAllowancePct).length > 0;

const lineNo = (key) => Number(String(key).replace(/\D/g, '')) || 0;

/**
 * Highest line number this requirement has ever issued. `lastLineNo` keeps it after lines
 * are removed, so a key is never reissued (a reissued key would inherit the removed
 * line's grid selection and audit history).
 */
export const highestLineNo = (doc) => doc.lines.reduce((m, l) => Math.max(m, lineNo(l.key)), doc.lastLineNo || 0);

/** Monotonic line keys (never Date.now — two lines added in one millisecond would collide). */
export const lineKeyFactory = (lines, lastLineNo = 0) => {
  let n = highestLineNo({ lines, lastLineNo });
  return () => `L${++n}`;
};

/**
 * "+ Add to Grid": Colours x Panels x Processes (PRD §8.2.1). Existing combinations are
 * skipped (§8.2.3). Sequence follows the chip order and continues after the highest
 * sequence already on that Fabric + Colour + Panel, so it stays continuous.
 */
export const expandSelection = ({ fabric, colorNames, panels, processes, allowancePct, order, existingLines, lastLineNo }) => {
  const existing = new Set(existingLines.map(duplicateKey));
  const nextKey = lineKeyFactory(existingLines, lastLineNo);
  const lines = [];
  let skipped = 0;
  colorNames.forEach((colorName) => {
    const color = order.colors.find((c) => c.name === colorName) || { name: colorName };
    panels.forEach((panel) => {
      const draftBase = { fabricId: fabric.id, colorName, panelName: panel.partName };
      let seq = existingLines
        .filter((l) => sequenceGroupKey(l) === sequenceGroupKey(draftBase))
        .reduce((m, l) => Math.max(m, l.sequenceNo || 0), 0);
      processes.forEach((proc) => {
        const line = {
          key: '',
          fabricId: fabric.id, fabricCode: fabric.code, fabricName: fabric.name, bomConsumption: fabric.consumption,
          colorName, colorCode: color.code, colorHex: color.hex,
          panelId: panel.id, panelName: panel.partName, panelsPerGarment: panel.panelsPerGarment || 1,
          processId: proc.id, processName: proc.processName, processOtherName: proc.otherName || null,
          allowancePct: Number(allowancePct) || 0, isManualOverride: false, varianceReason: '',
        };
        if (existing.has(duplicateKey(line))) { skipped += 1; return; }
        existing.add(duplicateKey(line));
        seq += 1;
        lines.push({
          ...line,
          key: nextKey(),
          sequenceNo: seq,
          sizes: sizeCells(order, colorName, line.panelsPerGarment, line.allowancePct),
        });
      });
    });
  });
  return { lines, skipped };
};

/** Recalculate one line from the order (clears manual overrides on it). */
export const recalcLine = (line, order) => ({
  ...line,
  sizes: sizeCells(order, line.colorName, line.panelsPerGarment, line.allowancePct),
  isManualOverride: false,
});

export const setSizeQty = (line, size, qty) => {
  const sizes = { ...line.sizes, [size]: { ...line.sizes[size], requiredQty: qty } };
  const isManualOverride = Object.values(sizes).some((c) => Number(c.requiredQty) !== c.calculatedQty);
  return { ...line, sizes, isManualOverride };
};

/** After lines are removed, each Fabric + Colour + Panel is renumbered 1..n in its current order. */
export const renumberSequences = (lines) => {
  const seen = {};
  return [...lines]
    .sort((a, b) => (sequenceGroupKey(a).localeCompare(sequenceGroupKey(b))) || (a.sequenceNo - b.sequenceNo))
    .map((l) => {
      const g = sequenceGroupKey(l);
      seen[g] = (seen[g] || 0) + 1;
      return { ...l, sequenceNo: seen[g] };
    });
};

/** VAL-06: every Fabric + Colour + Panel must run 1..n with no gaps or duplicates. */
export const invalidSequenceGroups = (lines) => {
  const groups = {};
  lines.forEach((l) => { (groups[sequenceGroupKey(l)] ||= []).push(Number(l.sequenceNo)); });
  return Object.entries(groups)
    .filter(([, seqs]) => [...seqs].sort((a, b) => a - b).some((s, i) => s !== i + 1))
    .map(([g]) => g.split('|').slice(1).join(' · '));
};

/** Every order colour; for each, its lines by fabric + panel with the process chain in sequence. */
export const buildColourSummary = (lines, order) => order.colors.map((color) => {
  const own = lines.filter((l) => l.colorName === color.name);
  const byPanel = {};
  own.forEach((l) => { (byPanel[`${l.fabricName}|${l.panelName}`] ||= []).push(l); });
  return {
    color,
    panels: Object.entries(byPanel).map(([k, ls]) => ({
      fabricName: k.split('|')[0],
      panelName: k.split('|')[1],
      chain: [...ls].sort((a, b) => a.sequenceNo - b.sequenceNo)
        .map((l) => ({ process: processLabel(l), seq: l.sequenceNo, qty: lineTotal(l) })),
    })),
  };
});

/** Process-wise roll-up: colours, panels and total quantity per process. */
export const buildProcessRollup = (lines) => {
  const map = {};
  lines.forEach((l) => {
    const p = processLabel(l);
    map[p] ||= { process: p, colors: new Set(), panels: new Set(), totalQty: 0 };
    map[p].colors.add(l.colorName);
    map[p].panels.add(l.panelName);
    map[p].totalQty += lineTotal(l);
  });
  return Object.values(map).map((r) => ({ ...r, colors: [...r.colors], panels: [...r.panels] }));
};

export const cprTotals = (lines, sizes = []) => ({
  lineCount: lines.length,
  colorCount: new Set(lines.map((l) => l.colorName)).size,
  processCount: new Set(lines.map(processLabel)).size,
  totalQty: lines.reduce((s, l) => s + lineTotal(l), 0),
  bySize: Object.fromEntries(sizes.map((size) =>
    [size, lines.reduce((s, l) => s + (Number(l.sizes[size]?.requiredQty) || 0), 0)])),
});

/** VAL-07: a negative or non-numeric allowance or quantity anywhere on the line (blank is VAL-05). */
export const hasInvalidNumbers = (line) => Number.isNaN(Number(line.allowancePct)) || Number(line.allowancePct) < 0
  || Object.values(line.sizes).some((c) => Number.isNaN(Number(c.requiredQty)) || Number(c.requiredQty) < 0);

/** Save Draft checks only what would corrupt the draft: an order with an approved BOM, sane numbers. */
export const draftSaveErrors = (doc, order) => {
  if (!doc?.orderId || !order) return [CPR_VAL.VAL_01];
  if (!order.approvedBoms?.length || !doc.bomVersion) return [CPR_VAL.VAL_02];
  return doc.lines.some(hasInvalidNumbers) ? [CPR_VAL.VAL_07] : [];
};

/**
 * Pre-submit checks (PRD §8.4 / §12). `blocking` stops Submit; `uncoveredColors`
 * (WRN-03) only asks for confirmation. `orderAllowancePct` is the requirement's snapshot,
 * the same one the grid compares each line's allowance with (WRN-04).
 */
export const runPreSubmitChecks = (lines, order, orderAllowancePct) => {
  const blocking = [];
  if (!order) return { blocking: [CPR_VAL.VAL_01], uncoveredColors: [], checks: [] };
  const zeroCells = lines.filter((l) => Object.values(l.sizes)
    .some((c) => c.baseQty > 0 && !(Number(c.requiredQty) > 0)));
  const invalidNumbers = lines.filter(hasInvalidNumbers);
  const badSeq = invalidSequenceGroups(lines);
  const missingReason = lines.filter((l) => needsReason(l, orderAllowancePct) && !String(l.varianceReason || '').trim());
  const uncoveredColors = order.colors.filter((c) => !lines.some((l) => l.colorName === c.name)).map((c) => c.name);

  const checks = [
    { key: 'lines', label: 'At least one requirement line', ok: lines.length > 0, detail: CPR_VAL.VAL_04 },
    { key: 'cells', label: 'Every size with an order quantity has a requirement', ok: zeroCells.length === 0, detail: CPR_VAL.VAL_05 },
    { key: 'numbers', label: 'Quantities and allowances are valid numbers', ok: invalidNumbers.length === 0, detail: CPR_VAL.VAL_07 },
    { key: 'sequence', label: 'Process sequence is continuous per fabric, colour and panel', ok: badSeq.length === 0, detail: badSeq.length ? `${CPR_VAL.VAL_06} (${badSeq.join('; ')})` : CPR_VAL.VAL_06 },
    { key: 'reasons', label: 'Reasons recorded for quantity / allowance variances', ok: missingReason.length === 0, detail: CPR_VAL.REASON },
    { key: 'colours', label: 'Every order colour has a cut-panel process', ok: uncoveredColors.length === 0, warning: true, detail: uncoveredColors.length ? `No cut-panel process: ${uncoveredColors.join(', ')}` : '' },
  ];
  checks.filter((c) => !c.ok && !c.warning).forEach((c) => blocking.push(c.detail));
  return { blocking, uncoveredColors, checks };
};
