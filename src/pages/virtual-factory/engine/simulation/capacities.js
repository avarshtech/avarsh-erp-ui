import { clamp, groupBy, num, round, sum } from '../util.js';

/** Used only where the ERP has no figure yet; each use is named in `basis`. */
export const FALLBACK = { cuttingPerDay: 2500, linePerDay: 600, rejectPct: 3, pcsPerCarton: 24, lines: 4 };

const mean = (values) => (values.length ? sum(values) / values.length : 0);

/**
 * Daily capacities for the simulation, read from the live factory: cutting from the last two weeks
 * of cut output, each sewing line from its plan's target, packing from recent completed packing,
 * rejection from today's end-line rework. Finishing has no live station data, so it is sized just
 * above sewing (finishing lines are normally built not to be the constraint).
 */
export const liveCapacities = (snapshot, rules) => {
  const basis = [];
  const cutDays = snapshot.cutting.dailyCut.filter((d) => d.qty > 0)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-14);
  const cuttingPerDay = cutDays.length ? round(mean(cutDays.map((d) => d.qty))) : FALLBACK.cuttingPerDay;
  basis.push(cutDays.length ? `Cutting ${cuttingPerDay}/day: average of the last ${cutDays.length} cutting days.` : `Cutting ${cuttingPerDay}/day: no cutting history yet (default).`);

  const targets = snapshot.sewing.lines.map((l) => l.targetPerDay).filter((t) => t > 0);
  const typical = targets.length ? round(mean(targets)) : FALLBACK.linePerDay;
  const lines = snapshot.sewing.lines.length
    ? snapshot.sewing.lines.map((l) => ({ id: l.id, name: l.name, perDay: l.targetPerDay > 0 ? l.targetPerDay : typical, active: l.active }))
    : Array.from({ length: FALLBACK.lines }, (_, i) => ({ id: `line-${i + 1}`, name: `Line ${i + 1}`, perDay: typical, active: false }));
  basis.push(targets.length ? `Sewing lines at their plan targets (typical ${typical}/day).` : `Sewing lines at ${typical}/day each (no plan targets yet, default).`);

  const sewingPerDay = sum(lines, (l) => l.perDay);
  const finishingPerDay = round(sewingPerDay * 1.15);
  basis.push(`Finishing ${finishingPerDay}/day: sized 15% above sewing (no live station data).`);

  const packedByDay = groupBy(snapshot.packing.completed.filter((e) => e.date), (e) => e.date);
  const packDays = [...packedByDay.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => sum(list, (e) => e.pieces)).filter((p) => p > 0).slice(-14);
  const packingPerDay = packDays.length ? round(mean(packDays)) : round(sewingPerDay * 1.2);
  basis.push(packDays.length ? `Packing ${packingPerDay}/day: average of ${packDays.length} recent packing days.` : `Packing ${packingPerDay}/day: sized 20% above sewing (no packing history).`);

  const qc = snapshot.qc;
  const rejectPct = qc.inspected > 0 ? round(clamp((qc.rework / qc.inspected) * 100, 0.5, 30), 1) : FALLBACK.rejectPct;
  basis.push(qc.inspected > 0 ? `Rework ${rejectPct}% from today's end-line inspection.` : `Rework ${rejectPct}% (no inspection today, default).`);

  const cartons = sum(snapshot.packing.completed, (e) => e.cartons);
  const pcsPerCarton = cartons ? round(sum(snapshot.packing.completed, (e) => e.pieces) / cartons) : FALLBACK.pcsPerCarton;

  return {
    hoursPerDay: num(rules.shift.hours, 8),
    sundayOff: true,
    cuttingPerDay,
    lines,
    finishingPerDay,
    packingPerDay,
    rejectPct,
    pcsPerCarton: Math.max(1, pcsPerCarton),
    basis,
  };
};
