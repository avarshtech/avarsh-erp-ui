/**
 * Pull-back return rows (pure). A new return opens with each line's open pieces at its expected stage,
 * split over sizes like the vendor POs; the gate edits what actually arrived.
 */
import {
  NOT_STARTED, PULLBACK_STATUS, stageLabel, stageSeq,
} from '../../../../utils/jobWorkTracker/constants';
import { splitBySize } from '../../../../utils/jobWorkTracker/pullBackRules';

const lineQty = (pb, l) => Number(pb.status === PULLBACK_STATUS.APPROVED ? l.approved : l.requested) || 0;

/** Per colour, what the pull-back expects back: approved once approved, requested before. */
export const expectedByColour = (pb) => pb.lines.reduce((acc, l) => ({ ...acc, [l.colour]: (acc[l.colour] || 0) + lineQty(pb, l) }), {});

export const prefillReturnRows = (pb) => {
  const left = { ...pb.returnedByColour };
  const even = Object.fromEntries((pb.order.sizes || []).map((s) => [s, 1]));
  const rows = [];
  [...pb.lines].sort((a, b) => stageSeq(a.stage) - stageSeq(b.stage)).forEach((l) => {
    const used = Math.min(left[l.colour] || 0, lineQty(pb, l));
    left[l.colour] = (left[l.colour] || 0) - used;
    const open = lineQty(pb, l) - used;
    if (open <= 0) return;
    const weights = pb.withdrawals.find((w) => w.colour === l.colour && w.stage === l.stage)?.sizes;
    const split = splitBySize(open, weights && Object.keys(weights).length ? weights : even);
    Object.entries(split).forEach(([size, q]) => rows.push({
      _k: `${l.colour}|${size}|${l.stage}`, colour: l.colour, size, stage: l.stage, good: q, damaged: 0, damageSource: null,
    }));
  });
  return rows;
};

export const stageOptions = (pb) => [NOT_STARTED, ...pb.stages.filter((s) => s !== pb.finalStage)]
  .map((s) => ({ value: s, label: stageLabel(s) }));

/** Problems the gate can fix before saving: [{ colour?, message }]. The server checks again. */
export const returnProblems = (pb, rows) => {
  const out = [];
  const now = {};
  rows.forEach((r) => {
    const q = (Number(r.good) || 0) + (Number(r.damaged) || 0);
    now[r.colour] = (now[r.colour] || 0) + q;
    if (r.damaged > 0 && !r.damageSource) out.push({ colour: r.colour, message: `${r.colour} ${r.size}: say where the damage came from.` });
    if (q > 0 && (!r.colour || !r.size || !r.stage)) out.push({ message: 'Every line needs a colour, a size and a stage.' });
  });
  if (!Object.values(now).some((q) => q > 0)) out.push({ message: 'Enter at least one quantity.' });
  const expected = expectedByColour(pb);
  Object.entries(now).forEach(([c, q]) => {
    const before = pb.returnedByColour[c] || 0;
    if (q > 0 && before + q > (expected[c] || 0)) out.push({ colour: c, message: `${c}: ${before} back already + ${q} is more than the ${expected[c] || 0} on the pull-back.` });
  });
  return out;
};
