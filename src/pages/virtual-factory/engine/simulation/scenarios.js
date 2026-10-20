import { num } from '../util.js';
import { workingDaysUntil } from './calendar.js';

/** The management questions, each a one-click change to the scenario. */
export const WHAT_IF_PRESETS = [
  { id: 'add-line', label: 'Add another sewing line', apply: (s) => ({ ...s, addLine: true }) },
  { id: 'line-down', label: 'A line is unavailable', apply: (s, lines) => ({ ...s, lineDown: (lines[2] || lines[0])?.id ?? null }) },
  { id: 'maintenance', label: 'A line goes for maintenance', apply: (s, lines) => ({ ...s, maintenanceLine: (lines[1] || lines[0])?.id ?? null }) },
  { id: 'fabric-late', label: 'Fabric arrives 2 days late', apply: (s) => ({ ...s, fabricDelayDays: 2 }) },
  { id: 'capacity', label: 'Capacity up 15%', apply: (s) => ({ ...s, capacityPct: 15 }) },
  { id: 'overtime', label: 'Add 2 hours overtime', apply: (s) => ({ ...s, overtimeHours: 2 }) },
  { id: 'rejection', label: 'QC rejection rises to 5%', apply: (s) => ({ ...s, rejectPct: 5 }) },
  { id: 'urgent', label: 'An urgent order is inserted', apply: (s) => ({ ...s, urgentQty: 5000 }) },
];

export const NO_WHAT_IF = { addLine: false, lineDown: null, maintenanceLine: null, fabricDelayDays: 0, capacityPct: 0, overtimeHours: 0, rejectPct: null, urgentQty: 0 };

/** A line in planned maintenance keeps half its machines running. */
export const MAINTENANCE_SHARE = 0.5;

/** Working days until the order's open fabric POs are due (0 when its material is in or issued). */
export const materialReadyDays = (snapshot, orderNo, sundayOff) => {
  const progress = snapshot.progress.get(orderNo);
  if (!progress || ['issued', 'received', 'none'].includes(progress.material)) return 0;
  const open = snapshot.purchaseOrders.filter((po) => po.orderRefs.some((r) => r.orderNo === orderNo)
    && (po.status === 'Sent_To_Supplier' || po.status === 'Partially_Received' || po.status === 'Pending_Approval' || po.status === 'Draft'));
  return Math.max(0, ...open.map((po) => workingDaysUntil(snapshot.today, po.due, sundayOff)));
};

/** A scenario for an existing order: its remaining quantity on the lines it can use, from today. */
export const scenarioForOrder = (snapshot, capacities, orderNo) => {
  const order = snapshot.orders.find((o) => o.no === orderNo);
  const progress = snapshot.progress.get(orderNo);
  const sewn = num(progress?.stages.find((s) => s.key === 'sewing')?.qty);
  return {
    orderNo,
    label: order ? `${order.no} · ${order.buyer}` : orderNo,
    qty: Math.max(100, num(order?.qty) - sewn),
    startDay: snapshot.today,
    dueDay: order?.due || null,
    destination: order?.destination || '',
    lineIds: capacities.lines.map((l) => l.id),
    materialReadyDays: materialReadyDays(snapshot, orderNo, capacities.sundayOff),
    ...NO_WHAT_IF,
  };
};

/** A hypothetical order to try the floor's capacity with. */
export const hypotheticalScenario = (snapshot, capacities, qty = 20000) => ({
  orderNo: null,
  label: 'Hypothetical order',
  qty,
  startDay: snapshot.today,
  dueDay: null,
  lineIds: capacities.lines.map((l) => l.id),
  materialReadyDays: 0,
  ...NO_WHAT_IF,
});

export const hasWhatIf = (s) => s.addLine || s.lineDown != null || s.maintenanceLine != null || s.fabricDelayDays > 0 || s.capacityPct !== 0
  || s.overtimeHours > 0 || s.rejectPct != null || s.urgentQty > 0;
