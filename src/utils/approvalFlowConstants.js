export const ENTITY_TYPES = [
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'COST_SHEET', label: 'Cost Sheet' },
  { value: 'ORDER', label: 'Order' },
  { value: 'GRN', label: 'Goods Receipt Note' },
  { value: 'CUTTING_PO', label: 'Cutting PO' },
  { value: 'WORK_ORDER', label: 'Work Order' },
  { value: 'PRODUCTION_PO', label: 'Production PO' },
];

export const ENTITY_TYPE_COLORS = {
  PURCHASE_ORDER: 'blue',
  COST_SHEET: 'purple',
  ORDER: 'green',
  GRN: 'orange',
  CUTTING_PO: 'cyan',
  WORK_ORDER: 'magenta',
  PRODUCTION_PO: 'lime',
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

export const CONDITION_FIELDS = {
  PURCHASE_ORDER: [
    { value: 'grandTotal', label: 'Grand Total', type: 'number' },
    { value: 'poType', label: 'PO Type', type: 'select', options: ['General', 'Regular', 'Combined'] },
  ],
  COST_SHEET: [
    { value: 'totalPrice', label: 'Total Price', type: 'number' },
  ],
  ORDER: [
    { value: 'totalQuantity', label: 'Total Quantity', type: 'number' },
  ],
  GRN: [],
  CUTTING_PO: [
    { value: 'totalPlannedQty', label: 'Total Planned Qty', type: 'number' },
    { value: 'processingUnitType', label: 'Processing Type', type: 'select', options: ['UNIT', 'VENDOR'] },
  ],
  WORK_ORDER: [
    { value: 'totalPlannedQty', label: 'Total Planned Qty', type: 'number' },
    { value: 'processingUnitType', label: 'Processing Type', type: 'select', options: ['UNIT', 'VENDOR'] },
  ],
  PRODUCTION_PO: [
    { value: 'totalOrderQty', label: 'Total Order Qty', type: 'number' },
  ],
};
