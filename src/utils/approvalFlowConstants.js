export const ENTITY_TYPES = [
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'COST_SHEET', label: 'Cost Sheet' },
  { value: 'ORDER', label: 'Order' },
  { value: 'GRN', label: 'Goods Receipt Note' },
  { value: 'GRN_REVERSAL', label: 'GRN Reversal' },
  { value: 'QC', label: 'QC Inspection' },
  { value: 'LEAVE', label: 'Leave Application' },
  { value: 'GATE_PASS', label: 'Gate Pass' },
  { value: 'MISS_PUNCH', label: 'Miss Punch' },
  { value: 'PAYROLL_RUN', label: 'Payroll Run' },
  { value: 'BONUS_RUN', label: 'Bonus Run' },
  { value: 'FNF_SETTLEMENT', label: 'F&F Settlement' },
  { value: 'EL_ENCASHMENT', label: 'EL Encashment' },
  { value: 'CUTTING_PO', label: 'Cutting PO' },
  { value: 'WORK_ORDER', label: 'Work Order (Sewing)' },
  { value: 'FINISHING_PO', label: 'Finishing PO' },
  { value: 'BILL_PASSING', label: 'Bill Passing' },
  { value: 'CUT_PANEL_PO', label: 'Cut Panel PO' },
  { value: 'GARMENT_PROCESS_PO', label: 'Garment Process PO' },
  { value: 'EXPORT_PACKING_LIST', label: 'Packing List' },
  { value: 'EXPORT_INVOICE', label: 'Export Invoice' },
];

/**
 * Entity types a flow cannot be created for yet, and why. GRN has no approval hooks in the backend
 * (submit goes straight to QC), so a GRN flow would collect decisions that never apply to the
 * document. The export documents get theirs when finalising moves to the server (packing lists, then
 * invoices); until then nothing submits them, so a flow would never fire.
 */
const FLOW_UNAVAILABLE = {
  GRN: 'GRN approval happens through QC — a flow on GRN would have no effect. Use QC or GRN Reversal instead.',
  EXPORT_PACKING_LIST: 'Packing lists are not sent for approval yet — this becomes available when finalising moves to the server.',
  EXPORT_INVOICE: 'Export invoices are not sent for approval yet — this becomes available when finalising moves to the server.',
};

/** Entity-type options for flow creation; the unavailable ones are shown disabled with their reason. */
export const FLOW_ENTITY_TYPE_OPTIONS = ENTITY_TYPES.map((t) =>
  FLOW_UNAVAILABLE[t.value] ? { ...t, disabled: true, title: FLOW_UNAVAILABLE[t.value] } : t,
);

export const ENTITY_TYPE_COLORS = {
  PURCHASE_ORDER: 'blue',
  COST_SHEET: 'purple',
  ORDER: 'green',
  GRN: 'orange',
  GRN_REVERSAL: 'volcano',
  QC: 'gold',
  LEAVE: 'cyan',
  GATE_PASS: 'geekblue',
  MISS_PUNCH: 'magenta',
  PAYROLL_RUN: 'lime',
  BONUS_RUN: 'lime',
  FNF_SETTLEMENT: 'red',
  EL_ENCASHMENT: 'cyan',
  CUTTING_PO: 'blue',
  WORK_ORDER: 'purple',
  FINISHING_PO: 'cyan',
  BILL_PASSING: 'gold',
  CUT_PANEL_PO: 'geekblue',
  GARMENT_PROCESS_PO: 'magenta',
  EXPORT_PACKING_LIST: 'green',
  EXPORT_INVOICE: 'gold',
};

/** Deep link to the entity behind an approval request (mirrors backend buildActionUrl). */
export const entityActionUrl = (entityType, entityId) => {
  switch (entityType) {
    case 'PURCHASE_ORDER': return `/purchase-orders/supplier-po/list?viewId=${entityId}`;
    case 'COST_SHEET': return `/costing/${entityId}`;
    case 'ORDER': return `/orders/list?viewId=${entityId}`;
    case 'GRN':
    case 'GRN_REVERSAL': return `/inventory/grn/list?viewId=${entityId}`;
    case 'QC': return `/inventory/qc?viewId=${entityId}`;
    case 'LEAVE': return `/hr/leaves?viewId=${entityId}`;
    case 'GATE_PASS': return `/hr/attendance/gate-pass?viewId=${entityId}`;
    case 'MISS_PUNCH': return `/hr/attendance/miss-punch?viewId=${entityId}`;
    case 'PAYROLL_RUN': return `/hr/payroll/${entityId}`;
    case 'BONUS_RUN': return `/hr/bonus?viewId=${entityId}`;
    case 'FNF_SETTLEMENT': return `/hr/fnf/${entityId}`;
    case 'EL_ENCASHMENT': return `/hr/statutory/el?viewId=${entityId}`;
    case 'CUTTING_PO': return `/purchase-orders/cutting-po/list?viewId=${entityId}`;
    case 'WORK_ORDER': return `/purchase-orders/work-order/list?viewId=${entityId}`;
    case 'FINISHING_PO': return `/purchase-orders/finishing-po/list?viewId=${entityId}`;
    case 'BILL_PASSING': return `/inventory/bill-passing?viewId=${entityId}`;
    case 'CUT_PANEL_PO': return `/purchase-orders/cut-panel-po/${entityId}`;
    case 'GARMENT_PROCESS_PO': return `/purchase-orders/garment-process-po/${entityId}`;
    case 'EXPORT_PACKING_LIST': return `/export-docs/packing-lists/edit/${entityId}`;
    case 'EXPORT_INVOICE': return `/export-docs/invoices/edit/${entityId}`;
    default: return '/';
  }
};

export const APPROVER_TYPES = [
  { value: 'ROLE', label: 'By Role' },
  { value: 'USER', label: 'By User' },
];

export const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REFERRED_BACK: 'REFERRED_BACK',
  CANCELLED: 'CANCELLED',
};

export const APPROVAL_STATUS_CONFIG = {
  PENDING: { color: 'processing', label: 'Pending' },
  APPROVED: { color: 'success', label: 'Approved' },
  REJECTED: { color: 'error', label: 'Rejected' },
  REFERRED_BACK: { color: 'warning', label: 'Referred Back' },
  CANCELLED: { color: 'default', label: 'Cancelled' },
};

export const CONDITION_OPERATORS = [
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '>=' },
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '<=' },
  { value: 'EQ', label: '=' },
  { value: 'NEQ', label: '!=' },
];

/** Definition of a condition field (label/type/options) for an entity type. */
export const getConditionField = (entityType, field) =>
  (CONDITION_FIELDS[entityType] || []).find((f) => f.value === field);

export const CONDITION_FIELDS = {
  PURCHASE_ORDER: [
    { value: 'grandTotal', label: 'Grand Total', type: 'number' },
    { value: 'poType', label: 'PO Type', type: 'select', options: ['General', 'Regular', 'Combined'] },
    { value: 'branchId', label: 'Deliver-to Branch', type: 'branch' },
  ],
  COST_SHEET: [
    { value: 'totalPrice', label: 'Total Price', type: 'number' },
  ],
  ORDER: [
    { value: 'totalQuantity', label: 'Total Quantity', type: 'number' },
    { value: 'requestType', label: 'Request Type', type: 'select', options: ['REFER_BACK', 'CANCEL'] },
  ],
  GRN: [],
  GRN_REVERSAL: [
    { value: 'branchId', label: 'Branch', type: 'branch' },
  ],
  BILL_PASSING: [
    { value: 'netPayable', label: 'Net Payable', type: 'number' },
    { value: 'debitPercent', label: 'Debit % of Invoice', type: 'number' },
    { value: 'supplierId', label: 'Supplier', type: 'number' },
  ],
  QC: [
    { value: 'qcType', label: 'QC Type', type: 'select', options: ['Fabric', 'Accessories'] },
    { value: 'stage', label: 'Stage', type: 'select', options: ['INSPECTION', 'REFER_BACK'] },
  ],
  LEAVE: [
    { value: 'days', label: 'Number of Days', type: 'number' },
  ],
  GATE_PASS: [],
  MISS_PUNCH: [],
  PAYROLL_RUN: [
    { value: 'netAmount', label: 'Net Amount', type: 'number' },
  ],
  BONUS_RUN: [
    { value: 'totalAmount', label: 'Total Amount', type: 'number' },
  ],
  FNF_SETTLEMENT: [
    { value: 'settlementAmount', label: 'Settlement Amount', type: 'number' },
  ],
  EL_ENCASHMENT: [
    { value: 'amount', label: 'Encashment Amount', type: 'number' },
  ],
  CUTTING_PO: [
    { value: 'totalPlannedQty', label: 'Planned Quantity', type: 'number' },
    { value: 'processingUnitType', label: 'Processing By', type: 'select', options: ['UNIT', 'VENDOR'] },
    { value: 'branchId', label: 'Branch', type: 'branch' },
  ],
  WORK_ORDER: [
    { value: 'totalPlannedQty', label: 'Planned Quantity', type: 'number' },
    { value: 'processingUnitType', label: 'Processing By', type: 'select', options: ['UNIT', 'VENDOR'] },
    { value: 'branchId', label: 'Branch', type: 'branch' },
  ],
  FINISHING_PO: [
    { value: 'totalPlannedQty', label: 'Planned Quantity', type: 'number' },
    { value: 'branchId', label: 'Branch', type: 'branch' },
  ],
  // The job-work POs route on their server-computed value (decision D1). A Cut Panel PO's reviewed tiers add a
  // level for an authorised override, a zero rate or a duplicate (needsAdditionalLevel) and can treat an
  // amendment apart (isAmendment).
  CUT_PANEL_PO: [
    { value: 'amount', label: 'PO Value', type: 'number' },
    { value: 'branchId', label: 'Branch', type: 'branch' },
    { value: 'needsAdditionalLevel', label: 'Override, zero rate or duplicate', type: 'select', options: ['true', 'false'] },
    { value: 'isAmendment', label: 'Is an amendment', type: 'select', options: ['true', 'false'] },
  ],
  GARMENT_PROCESS_PO: [
    { value: 'amount', label: 'PO Value', type: 'number' },
    { value: 'branchId', label: 'Branch', type: 'branch' },
  ],
  // The export documents. An invoice's value is in its own currency (the orders' cost-sheet currency), so a
  // value tier goes together with a Currency condition.
  EXPORT_PACKING_LIST: [
    { value: 'buyerId', label: 'Buyer', type: 'number' },
    { value: 'totalCartons', label: 'Total Cartons', type: 'number' },
  ],
  EXPORT_INVOICE: [
    { value: 'amount', label: 'Invoice Value', type: 'number' },
    { value: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    { value: 'buyerId', label: 'Buyer', type: 'number' },
  ],
};
