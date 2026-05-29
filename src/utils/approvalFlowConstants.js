export const ENTITY_TYPES = [
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'COST_SHEET', label: 'Cost Sheet' },
  { value: 'ORDER', label: 'Order' },
  { value: 'GRN', label: 'Goods Receipt Note' },
];

export const ENTITY_TYPE_COLORS = {
  PURCHASE_ORDER: 'blue',
  COST_SHEET: 'purple',
  ORDER: 'green',
  GRN: 'orange',
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
};
