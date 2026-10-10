/**
 * Time & Action governed masters (mock phase) — CR-TNA-001 §6 mapping matrix, FR-2.2,
 * FR-3.3/3.4, FR-12.1/12.2. The activity master names, per activity, the source screen,
 * the ONE completion event, its threshold, applicability, duration, day type, gate flag
 * and attribution. sourceStatus says whether that event exists in this ERP today:
 *   LIVE      the source record exists (Order, BOM, Samples, PO, GRN, QC, Cutting, Cut
 *             Panel / Garment Process returns, Sewing, Packing)
 *   PROPOSED  an approved source-screen enhancement (Round 2); simulated in the mock data
 *   MISSING   no source record and no approved enhancement → "Awaiting source enhancement"
 * Durations in the active version reproduce the §17 worked example exactly.
 */
import { CUT_PANEL_END, GARMENT_PROCESS_END } from './tnaDerivation';

// code, name, short, lane, module, screen, event, threshold, applicability, dur, dayType, gate, attribution, preds, extra
const def = (code, name, shortName, lane, sourceModule, sourceScreen, completionEvent, threshold, applicability,
  duration, dayType, isGate, attribution, predecessors, extra = {}) => ({
  code, name, shortName, lane, sourceModule, sourceScreen, completionEvent, threshold, applicability,
  duration, dayType, isGate, attribution, predecessors, sourceStatus: 'LIVE', ...extra,
});

const ALL = { type: 'ALL', label: 'All orders' };
const LAB_DIP = { type: 'SAMPLE', sampleTypes: ['Lab Dip', 'Strike Off'], label: 'Where a lab dip or strike-off request exists' };
const FIT = { type: 'SAMPLE', sampleTypes: ['Fit'], label: 'Where a fit sample request exists' };
const FABRIC_TEST = { type: 'FLAG', flag: 'fabricTestingContracted', label: 'Where fabric testing is contracted' };

export const coreActivities = [
  def('A01', 'Order receipt confirmed', 'Order', 'ORDER_PURCHASE', 'Order Entry', 'Order Entry', 'order.confirmed', null, ALL, 0, 'WD', false, 'INTERNAL_PRE_PRODUCTION', []),
  def('A02', 'BOM release', 'BOM', 'ORDER_PURCHASE', 'BOM', 'BOM', 'bom.version_released', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A01']),
  def('A03', 'Lab dip / strike-off dispatch', 'Lab dip disp.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.dispatched', null, LAB_DIP, 3, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A02'], { sampleStage: 'DISPATCH', sampleKey: 'LAB_DIP' }),
  def('A04', 'Lab dip / strike-off approval', 'Lab dip appr.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.approved', null, LAB_DIP, 5, 'CD', true, 'BUYER', ['A03'], { sampleStage: 'APPROVAL', sampleKey: 'LAB_DIP' }),
  def('A05', 'Fit sample dispatch', 'Fit disp.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.dispatched', null, FIT, 7, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A02'], { sampleStage: 'DISPATCH', sampleKey: 'FIT' }),
  def('A06', 'Fit sample buyer approval', 'Fit appr.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.approved', null, FIT, 7, 'CD', true, 'BUYER', ['A05'], { sampleStage: 'APPROVAL', sampleKey: 'FIT' }),
  def('A07', 'Fabric PO issue', 'Fabric PO', 'ORDER_PURCHASE', 'Purchase', 'Purchase Order', 'purchase_order.approved', null, ALL, 1, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A04'], { eventNote: 'Latest approval across all fabric POs for the order' }),
  def('A08', 'Trim PO issue', 'Trim PO', 'ORDER_PURCHASE', 'Purchase', 'Purchase Order', 'purchase_order.approved', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A02'], { eventNote: 'Latest approval across all trim POs for the order' }),
  def('A13', 'Bulk fabric in-house', 'Fabric in', 'STORE_QC', 'Stores', 'Stores › GRN', 'grn.accepted', 100, ALL, 18, 'CD', true, 'SUPPLIER', ['A07'], { qtyKey: 'fabric', eventNote: 'Cumulative accepted quantity first reaches the threshold' }),
  def('A14', 'Fabric testing / inspection', 'Fabric QC', 'STORE_QC', 'QC', 'QC › Fabric inspection', 'inspection.completed', null, ALL, 2, 'WD', true, 'QUALITY', ['A13'], { eventNote: 'Result Pass. A Fail does not complete the activity' }),
  def('A07b', 'Fabric quality approval', 'Fabric test', 'STORE_QC', 'QC', 'QC › Test report', 'test_report.passed', null, FABRIC_TEST, 2, 'WD', false, 'QUALITY', ['A14'], { sourceStatus: 'MISSING', missingNote: 'No test-report record exists in the ERP' }),
  def('A09', 'First Bulk Piece', 'FBP', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.dispatched', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A14'], { sampleStage: 'DISPATCH', sampleKey: 'FBP', sourceStatus: 'PROPOSED', proposal: 'New sample type "First Bulk Piece"' }),
  def('A10', 'PP sample dispatch', 'PP disp.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.dispatched', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A09'], { sampleStage: 'DISPATCH', sampleKey: 'PP' }),
  def('A11', 'PP sample buyer approval', 'PP appr.', 'SAMPLING', 'Sampling', 'Sample Request', 'sample.approved', null, ALL, 5, 'CD', true, 'BUYER', ['A10'], { sampleStage: 'APPROVAL', sampleKey: 'PP', eventNote: 'Outcome Approved. Gates bulk cutting' }),
  def('A12', 'Pattern grading', 'Pattern', 'PRE_PRODUCTION', 'BOM', 'BOM / Style', 'pattern.released', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A06'], { sourceStatus: 'PROPOSED', proposal: '"Pattern released" date and released-by on the BOM' }),
  def('A15', 'CAD marker / bulk programme', 'CAD marker', 'PRE_PRODUCTION', 'Cutting', 'Cutting › Marker plan', 'marker.released', null, ALL, 2, 'WD', false, 'INTERNAL_PRE_PRODUCTION', ['A12', 'A14'], { sourceStatus: 'PROPOSED', proposal: 'Completed-at on the Cut Marker Plan' }),
  def('A16', 'PP meeting', 'PP meeting', 'PRE_PRODUCTION', 'Production', 'Production › PP meeting', 'pp_meeting.recorded', null, ALL, 1, 'WD', true, 'INTERNAL_PRE_PRODUCTION', ['A11', 'A15'], { sourceStatus: 'PROPOSED', proposal: 'New PP meeting record: date, attendees, minutes', eventNote: 'Meeting recorded with minutes. Cutting cannot precede it' }),
  def('A17', 'Cutting', 'Cutting', 'CUTTING', 'Cutting', 'Cutting › Cut report', 'production.cut_output', 95, ALL, 3, 'WD', false, 'INTERNAL_PRODUCTION', ['A16'], { qtyKey: 'order' }),
  def('A20', 'Sewing', 'Sewing', 'SEWING', 'Sewing', 'Sewing › Hourly output', 'production.sewing_output', 95, ALL, 9, 'WD', false, 'INTERNAL_PRODUCTION', [CUT_PANEL_END], { qtyKey: 'order' }),
  def('A21', 'Finishing', 'Finishing', 'FINISHING_SHIPMENT', 'Finishing', 'Finishing', 'production.finishing_output', 95, ALL, 2, 'WD', false, 'INTERNAL_PRODUCTION', [GARMENT_PROCESS_END], { qtyKey: 'order', sourceStatus: 'MISSING', missingNote: 'No daily finishing-output record exists in the ERP' }),
  def('A22', 'Packing', 'Packing', 'FINISHING_SHIPMENT', 'Packing', 'Production › Packing', 'production.packing_completed', null, ALL, 2, 'WD', false, 'INTERNAL_PRODUCTION', ['A21'], { eventNote: 'All packing entries for the order completed' }),
  def('A23', 'Final inspection', 'Final AQL', 'STORE_QC', 'QC', 'QC › Final inspection', 'inspection.completed', null, ALL, 1, 'WD', false, 'QUALITY', ['A22'], { sourceStatus: 'MISSING', missingNote: 'No final (AQL) inspection record exists in the ERP' }),
  def('A24', 'Dispatch / handover', 'Dispatch', 'FINISHING_SHIPMENT', 'Orders', 'Orders › Dispatch', 'shipment.dispatched', null, ALL, 0, 'WD', false, 'INTERNAL_PRODUCTION', ['A23'], { isTerminal: true, sourceStatus: 'PROPOSED', proposal: 'Order-line dispatch record: date, quantity, invoice no.' }),
];

/** Process-step durations for derived Cut Panel (C) and Garment Process (G) activities. */
export const processSteps = {
  CUT_PANEL: {
    'Panel Printing': 2, 'Panel Embroidery': 3, 'Heat Transfer': 1, 'Sequin Work': 3, default: 2,
  },
  GARMENT_PROCESS: {
    'Enzyme Washing': 2, 'Bleach Washing': 1, 'Softener Washing': 1, 'Garment Dyeing': 3, 'Stone Washing': 2, default: 2,
  },
  threshold: 95,
};

/** Lead-time precedence (FR-3.3): buyer + product type, then product type, then global. */
export const seedDurationOverrides = [
  { id: 1, buyer: null, productType: 'Knits', activityCode: 'A13', duration: 21, note: 'Knit fabric: knitting + dyeing' },
  { id: 2, buyer: 'Zara', productType: 'Knits', activityCode: 'A04', duration: 7, note: 'Zara lab-dip panel meets weekly' },
  { id: 3, buyer: null, productType: 'Kidswear', activityCode: 'A17', duration: 4, note: 'Kidswear: more small panels per lay' },
];

/** Factory working calendar (FR-3.5, A-02, DEP-09). */
export const seedCalendar = {
  name: 'Factory calendar 2026',
  weeklyOff: [0],
  holidays: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-15', name: 'Pongal' },
    { date: '2026-01-16', name: 'Thiruvalluvar Day' },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-04-14', name: 'Tamil New Year' },
    { date: '2026-05-01', name: 'May Day' },
    { date: '2026-08-26', name: 'Milad-un-Nabi' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Ayudha Pooja' },
    { date: '2026-10-21', name: 'Vijayadashami' },
    { date: '2026-11-08', name: 'Deepavali' },
  ],
};

export const seedSettings = { floatWarningWd: 3, dueSoonWd: 3, reasonUnavailableCeilingPct: 10, materialThresholdPct: 100, productionThresholdPct: 95 };

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Versioned masters (FR-12.1/12.2): plans record the version that generated them. */
export const seedMasterVersions = () => [
  { id: 6, versionNo: 6, status: 'ACTIVE', effectiveFrom: '2026-06-01', approvedBy: 'K. Rao (Merchandising Mgr)', approvedOn: '2026-05-28', activities: clone(coreActivities) },
  { id: 7, versionNo: 7, status: 'DRAFT', effectiveFrom: '2026-11-01', approvedBy: null, approvedOn: null, activities: clone(coreActivities) },
];
