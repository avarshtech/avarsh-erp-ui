import { dayOf, num, sum, text } from '../util.js';

const HOURS = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'];

/**
 * The most recent hourly output entered: the floor fills an hour in after it ends, so the current
 * hour and the two before it are read and the latest non-zero one counts.
 */
const recentHourOutput = (rows, hourIndex) => {
  for (let h = hourIndex; h >= Math.max(1, hourIndex - 2); h -= 1) {
    const out = sum(rows, (r) => r[HOURS[h - 1]]);
    if (out > 0) return out;
  }
  return 0;
};

const stationsFor = (plan, sheet, lineRow, hourIndex) => {
  const rows = sheet?.rows || [];
  return [...(plan?.operations || [])]
    .sort((a, b) => num(a.seq) - num(b.seq))
    .map((op) => {
      const mine = rows.filter((r) => (op.operationId != null && r.operationId === op.operationId)
        || (op.operationId == null && text(r.operation) === text(op.operation)));
      // Without the line's hourly sheet the station has no figures of its own (the lamp follows the line).
      const lastHour = sheet ? recentHourOutput(mine, hourIndex) : null;
      const output = sheet ? sum(mine, (r) => r.total) : null;
      const running = Boolean(lineRow) && (sheet ? mine.length > 0 && lastHour > 0 : num(lineRow?.lastHourOutput) > 0);
      // Earned minutes (pieces × SAM) over the minutes its operators have worked so far.
      const efficiencyPct = output != null && num(op.sam) > 0 && mine.length
        ? (output * num(op.sam) * 100) / (Math.max(1, hourIndex) * 60 * mine.length) : null;
      return {
        seq: num(op.seq),
        operation: text(op.operation),
        machine: text(op.machine).toUpperCase(),
        sam: num(op.sam),
        targetPerHour: num(op.targetPerHour),
        bottleneck: Boolean(op.bottleneck),
        operator: mine[0] ? { name: text(mine[0].operatorName), code: text(mine[0].operatorCode), more: mine.length - 1 } : null,
        output,
        lastHourOutput: lastHour,
        efficiencyPct,
        status: running ? 'RUNNING' : 'IDLE',
      };
    });
};

/** End-line inspections (TOPSE) for one day, per line. */
const qcByLine = (topse, today) => {
  const map = new Map();
  (topse || []).filter((r) => dayOf(r.reportDate) === today).forEach((r) => {
    const cur = map.get(r.lineId) || { inspected: 0, defects: 0, rework: 0, styles: new Set(), traffic: null };
    cur.inspected += num(r.totalInspected);
    cur.defects += num(r.totalDefects);
    cur.rework += num(r.totalRework);
    if (r.styleNo) cur.styles.add(text(r.styleNo));
    cur.traffic = text(r.trafficLight) || cur.traffic;
    map.set(r.lineId, cur);
  });
  return map;
};

/**
 * Sewing lines: the production-line master, today's floor dashboard (one row per running plan),
 * the plans' operation breakdowns, today's hourly sheets and today's end-line inspections.
 */
export const adaptSewing = ({ lines, dashboard, plans, sheets, topse }, clock) => {
  const dash = dashboard || {};
  const rowsByLine = new Map((dash.lines || []).map((row) => [row.lineId, row]));
  const planById = new Map((plans || []).map((p) => [p.id, p]));
  const qc = qcByLine(topse, clock.today);
  const master = (lines || []).filter((l) => !l.lineType || /sew/i.test(l.lineType));
  const known = new Set(master.map((l) => l.id));
  const extra = (dash.lines || []).filter((row) => !known.has(row.lineId))
    .map((row) => ({ id: row.lineId, name: row.line }));

  return {
    thresholds: {
      efficiencyGreen: num(dash.efficiencyGreenPct, 85),
      efficiencyYellow: num(dash.efficiencyYellowPct, 70),
      absenteeism: num(dash.absenteeismAlertPct, 10),
      dhu: num(dash.dhuThresholdPct, 5),
    },
    alerts: (dash.alerts || []).map((a) => ({ type: text(a.type), text: text(a.text) })),
    plans: (plans || []).map((p) => ({ id: p.id, planNo: text(p.planNo), orderNo: text(p.orderNo), style: text(p.styleNo), line: text(p.line), status: text(p.status) })),
    lines: [...master, ...extra].map((line) => {
      const row = rowsByLine.get(line.id) || null;
      const plan = row ? planById.get(row.planId) : null;
      const sheet = row ? sheets?.get?.(row.planId) || null : null;
      const lineQc = qc.get(line.id);
      const queued = (plans || []).filter((p) => p.lineId === line.id && p.status === 'APPROVED');
      return {
        id: line.id,
        name: text(line.name),
        unit: text(line.unitName),
        capacity: num(line.capacityOperators),
        active: Boolean(row),
        planId: row?.planId ?? null,
        planNo: text(row?.planNo),
        orderNo: text(row?.orderNo),
        style: text(row?.styleNo),
        buyer: text(plan?.buyer),
        planQty: num(plan?.totalQty),
        operatorsPlanned: num(row?.operatorsPlanned),
        operatorsPresent: num(row?.operatorsPresent),
        absenteeismPct: num(row?.absenteeismPct),
        output: num(row?.output),
        completed: num(row?.completed),
        lastHourOutput: num(row?.lastHourOutput),
        targetPerHour: num(row?.targetPerHour),
        targetPerDay: num(row?.targetPerDay),
        efficiencyPct: row?.efficiencyPct == null ? null : num(row.efficiencyPct),
        traffic: text(row?.trafficLight).toUpperCase() || null,
        dhuPct: row?.dhuPct == null ? null : num(row.dhuPct),
        wip: num(row?.wip),
        stations: stationsFor(plan, sheet, row, clock.hourIndex),
        hasSheet: Boolean(sheet),
        queuedOrders: queued.map((p) => text(p.orderNo)).filter(Boolean),
        qc: lineQc ? {
          inspected: lineQc.inspected,
          defects: lineQc.defects,
          rework: lineQc.rework,
          dhuPct: lineQc.inspected ? (lineQc.defects / lineQc.inspected) * 100 : 0,
          styles: [...lineQc.styles],
          traffic: lineQc.traffic,
        } : null,
      };
    }),
  };
};

/** Today's end-line QC across all lines. */
export const sewingQcTotals = (sewing) => {
  const withQc = sewing.lines.filter((l) => l.qc);
  const inspected = sum(withQc, (l) => l.qc.inspected);
  const defects = sum(withQc, (l) => l.qc.defects);
  return {
    inspected,
    defects,
    rework: sum(withQc, (l) => l.qc.rework),
    dhuPct: inspected ? (defects / inspected) * 100 : null,
    byLine: withQc.map((l) => ({ lineId: l.id, line: l.name, style: l.qc.styles[0] || l.style, ...l.qc })),
  };
};
