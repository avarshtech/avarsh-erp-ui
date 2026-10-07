/**
 * One job order's full picture from the inward demo — materials, progress, returns, charges, waste,
 * status and risk — computed for `today`. Every inward mock endpoint reads job orders through here,
 * so the rules live in src/utils/jobWorkInward only.
 */
import {
  INWARD_STAGE, INWARD_STAGE_LABEL, JO_STATUS, MATERIAL_KIND, STAGES_BY_SCOPE,
} from '../../../utils/jobWorkInward/inwardConstants';
import {
  mainMaterialIn, materialStatus, orderQty, waitingForPrincipal,
} from '../../../utils/jobWorkInward/materialRules';
import {
  bySize, cumulativeProgress, deriveStatus, projectFinish, remainingBySize, riskOf, sumBySize,
} from '../../../utils/jobWorkInward/progressRules';
import { billingOverdue, isInterState, returnCharges } from '../../../utils/jobWorkInward/chargeRules';
import {
  liveLots, liveReturns, wasteFor, withOutstanding,
} from './inwardMockLedger';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const deepSum = (bySizeByColour) => sum(Object.values(bySizeByColour || {}).map((s) => sum(Object.values(s))));

export const jobOrderContext = (db, jo, today) => {
  const principal = db.principals.find((p) => p.id === jo.principalId);
  const rets = liveReturns(db, jo.id);
  const waste = wasteFor(db, jo.id);
  const lots = withOutstanding(jo, liveLots(db, (l) => l.jobOrderId === jo.id), rets, waste, today);
  const status = materialStatus(jo, lots);
  const prog = cumulativeProgress(db.progress.filter((p) => p.jobOrderId === jo.id));
  const packedBySize = bySize(prog.packed, jo);
  const rejectsBySize = bySize(prog.rejects, jo);
  const returnedBySize = sumBySize(rets.flatMap((r) => r.garments));
  const rejectsReturnedBySize = sumBySize(rets.flatMap((r) => r.rejects));
  const qty = orderQty(jo);
  const goodReturned = deepSum(returnedBySize);
  const rejectsReturned = deepSum(rejectsReturnedBySize);
  const derived = deriveStatus({ stored: jo.status, issuedAny: lots.some((l) => l.ledger.issued > 0), goodReturned, rejectsReturned, orderQty: qty });
  const packedTotal = sum(Object.values(prog.packed));
  const rejectsTotal = sum(Object.values(prog.rejects));
  const projectedDate = projectFinish({ days: prog.days, remaining: Math.max(0, qty - packedTotal - rejectsTotal), today });
  const risk = riskOf({ status: derived, dueDate: jo.dueDate, projectedDate, today });
  const charges = rets.map((r) => ({
    returnId: r.id, returnNo: r.returnNo, date: r.date, tally: r.tally,
    overdue: billingOverdue({ returnDate: r.date, today, invoiced: !!r.tally }),
    ...returnCharges({ jo, principal, branch: db.branch, garments: r.garments }),
  }));
  const main = mainMaterialIn(jo, status);
  const stageValue = {
    [INWARD_STAGE.MATERIAL_IN]: { cum: main.cum, plan: main.plan },
    [INWARD_STAGE.PANELS_IN]: { cum: main.cum, plan: main.plan },
    [INWARD_STAGE.CUT]: { cum: sum(Object.values(prog.cut)), plan: qty },
    [INWARD_STAGE.STITCHED]: { cum: prog.stitched, plan: qty },
    [INWARD_STAGE.PACKED]: { cum: packedTotal, plan: qty },
    [INWARD_STAGE.RETURNED]: { cum: goodReturned + rejectsReturned, plan: qty },
  };
  const stages = STAGES_BY_SCOPE[jo.scope].map((stage) => ({ stage, label: INWARD_STAGE_LABEL[stage], ...stageValue[stage] }));
  const inStoreLots = lots.filter((l) => l.ledger.inStore > 1e-9);
  const open = ![JO_STATUS.CLOSED, JO_STATUS.CANCELLED].includes(derived);
  return {
    jo, principal, branch: db.branch, interState: isInterState(principal, db.branch), lots, status, prog, stages,
    packedBySize, rejectsBySize, returnedBySize, rejectsReturnedBySize,
    ready: remainingBySize(packedBySize, returnedBySize), rejectsAvailable: remainingBySize(rejectsBySize, rejectsReturnedBySize),
    qty, goodReturned, rejectsReturned, packedTotal, rejectsTotal, derived, open, projectedDate, risk,
    rets, charges, waste, inStoreLots,
    waiting: open && waitingForPrincipal(status),
    shortLines: open ? status.filter((m) => m.short > 0) : [],
    ageLevel: Math.max(0, ...lots.map((l) => l.ageLevel)),
    readyToClose: derived === JO_STATUS.RETURNED && !inStoreLots.length && waste.onHand <= 0 && charges.every((c) => c.tally),
    fabricUse: db.fabricUse.filter((f) => f.jobOrderId === jo.id),
    mainKind: status.find((m) => m.kind === MATERIAL_KIND.FABRIC) ? MATERIAL_KIND.FABRIC : MATERIAL_KIND.PANELS,
  };
};

/** One row of the Job Orders list. */
export const toRow = (ctx) => {
  const { jo, principal } = ctx;
  return {
    id: jo.id, orderNo: jo.orderNo, principalId: principal.id, principalName: principal.name, principalRef: jo.principalRef,
    styleNo: jo.styleNo, styleName: jo.styleName, scope: jo.scope, qty: ctx.qty, returned: ctx.goodReturned + ctx.rejectsReturned, rate: jo.rate, dueDate: jo.dueDate,
    projectedDate: ctx.projectedDate, risk: ctx.risk, status: ctx.derived, open: ctx.open, stages: ctx.stages,
    waiting: ctx.waiting, shortLines: ctx.shortLines.map((m) => ({ itemName: m.itemName, short: m.short, uom: m.uom })),
    readyToReturn: deepSum(ctx.ready), chargesTotal: sum(ctx.charges.map((c) => c.total)),
    unbilled: ctx.charges.filter((c) => !c.tally).length, billingOverdue: ctx.charges.some((c) => c.overdue),
    readyToClose: ctx.readyToClose, interState: ctx.interState, ageLevel: ctx.ageLevel,
  };
};
