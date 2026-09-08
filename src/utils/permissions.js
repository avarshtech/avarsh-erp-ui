/**
 * RBAC Permission System
 * Defines pages, operations, and permission utilities
 *
 * Permission JSON Structure (stored in DB & JWT token):
 * {
 *   "dashboard":        { "access": true, "operations": { "view": true } },
 *   "orders":           { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "order-actions":    { "access": true, "operations": { "refer_back": true, "cancel": true, "approve": true, "reject": true } },
 *   "bom":              { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "purchase-orders":  { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "po-approval":      { "access": true, "operations": { "approve": true, "reject": true, "cancel": true, "refer_back": true } },
 *   "cutting-po":       { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "work-order":       { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "finishing-po":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "production-cutting":   { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "production-sewing":    { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "production-finishing": { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "production-masters":   { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "inventory":        { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "inventory-qc":     { "access": true, "operations": { "view": true, "add": true, "update": true, "approve": true } },
 *   "inventory-issue":  { "access": true, "operations": { "view": true, "add": true, "update": true } },
 *   "inventory-adjustment": { "access": true, "operations": { "view": true, "add": true, "update": true, "approve": true } },
 *   "costing":          { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "costing-approval": { "access": true, "operations": { "approve": true, "revise": true } },
 *   "buyer-info":       { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "supplier-info":    { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "master-data":      { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "items":            { "access": true, "operations": { "view": true, "add": true, "update": true } },
 *   "style-master":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "size-presets":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "payment-terms":    { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "process-master":   { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "parts-master":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "overhead-master":  { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "users":            { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "roles":            { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "couriers":         { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "approval-flows":   { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "company-profile":  { "access": true, "operations": { "view": true, "add": true, "update": true } },
 *   "ai-assistant":     { "access": true, "operations": { "view": true } }
 * }
 */

// ─── MODULE DEFINITIONS ─────────────────────────────────────────────────────────

export const MODULES = {
  DASHBOARD: {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    group: 'main',
  },
  ORDERS: {
    id: 'orders',
    name: 'Orders',
    path: '/orders',
    group: 'transactions',
  },
  BOM: {
    id: 'bom',
    name: 'Bill of Materials',
    path: '/bom',
    group: 'transactions',
  },
  SAMPLE_REQUESTS: {
    id: 'sample-requests',
    name: 'Sample Requests',
    path: '/sample-requests/list',
    group: 'transactions',
  },
  SAMPLE_DISPATCHES: {
    id: 'sample-dispatches',
    name: 'Sample Dispatches',
    path: '/sample-requests/dispatches/list',
    group: 'transactions',
  },
  SAMPLE_COMMENTS: {
    id: 'sample-comments',
    name: 'Customer Comments',
    path: '/sample-requests/comments',
    group: 'transactions',
  },
  SAMPLE_INVOICES: {
    id: 'sample-invoices',
    name: 'Invoices (Samples)',
    path: '/sample-requests/invoices/list',
    group: 'transactions',
  },
  PURCHASE_ORDERS: {
    id: 'purchase-orders',
    name: 'Supplier PO',
    path: '/purchase-orders/supplier-po/list',
    group: 'transactions',
  },
  ORDER_ACTIONS: {
    id: 'order-actions',
    name: 'Order Actions',
    path: '/orders', // Integrated within Orders module
    group: 'transactions',
    linkedTo: 'orders',
  },
  PO_APPROVAL: {
    id: 'po-approval',
    name: 'PO Approval',
    path: '/purchase-orders/supplier-po', // Integrated within Supplier PO module
    group: 'transactions',
    linkedTo: 'purchase-orders',
  },
  GRN_APPROVAL: {
    id: 'grn-approval',
    name: 'GRN Refer-Back Approval',
    path: '/inventory/grn', // Integrated within GRN module
    group: 'transactions',
    linkedTo: 'inventory',
  },
  GRN_REVERSAL: {
    id: 'grn-reversal',
    name: 'GRN Reversal Approval',
    path: '/inventory/grn', // Integrated within GRN module
    group: 'transactions',
    linkedTo: 'inventory',
  },
  CUTTING_PO: {
    id: 'cutting-po',
    name: 'Cutting PO',
    path: '/purchase-orders/cutting-po/list',
    group: 'transactions',
  },
  WORK_ORDER: {
    id: 'work-order',
    name: 'Work Orders',
    path: '/purchase-orders/work-order/list',
    group: 'transactions',
  },
  FINISHING_PO: {
    id: 'finishing-po',
    name: 'Finishing PO',
    path: '/purchase-orders/finishing-po/list',
    group: 'transactions',
  },  TNA: {
    id: 'tna',
    name: 'Time & Action',
    path: '/tna/control-tower',
    group: 'transactions',
  },
  TNA_MASTERS: {
    id: 'tna-masters',
    name: 'TNA Masters',
    path: '/tna/masters',
    group: 'transactions',
  },
  TNA_REPLAN_APPROVAL: {
    id: 'tna-replan-approval',
    name: 'TNA Re-plan Approvals',
    path: '/tna/replans',
    group: 'transactions',
  },
  PRODUCTION_CUTTING: {
    id: 'production-cutting',
    name: 'Production — Cutting',
    path: '/production/cutting',
    group: 'transactions',
  },
  PRODUCTION_SEWING: {
    id: 'production-sewing',
    name: 'Production — Sewing',
    path: '/production/sewing',
    group: 'transactions',
  },
  PRODUCTION_FINISHING: {
    id: 'production-finishing',
    name: 'Production — Finishing',
    path: '/production/finishing',
    group: 'transactions',
  },
  EXPORT_PACKING: {
    id: 'export-packing',
    name: 'Carton Packing Entry',
    path: '/export-docs/packing/list',
    group: 'transactions',
  },
  EXPORT_SHIPMENTS: {
    id: 'export-shipments',
    name: 'Shipments',
    path: '/export-docs/shipments/list',
    group: 'transactions',
  },
  EXPORT_PACKING_LIST: {
    id: 'export-packing-list',
    name: 'Packing List',
    path: '/export-docs/packing-lists/list',
    group: 'transactions',
  },
  EXPORT_INVOICE: {
    id: 'export-invoice',
    name: 'Export Invoice',
    path: '/export-docs/invoices/list',
    group: 'transactions',
  },
  EXPORT_STICKERS: {
    id: 'export-stickers',
    name: 'Carton Stickers',
    path: '/export-docs/stickers',
    group: 'transactions',
    // Stickers render an existing packing list — without PL access there is nothing to draw.
    linkedTo: 'export-packing-list',
  },
  EXPORT_TEMPLATES: {
    id: 'export-templates',
    name: 'Buyer Document Templates',
    path: '/export-docs/templates/list',
    group: 'transactions',
  },
  PRODUCTION_MASTERS: {
    id: 'production-masters',
    name: 'Production Masters',
    path: '/production/masters',
    group: 'masters',
  },
  INVENTORY: {
    id: 'inventory',
    name: 'Inventory Management',
    path: '/inventory',
    group: 'transactions',
  },
  INVENTORY_QC: {
    id: 'inventory-qc',
    name: 'Quality Control',
    path: '/inventory/qc',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  INVENTORY_ISSUE: {
    id: 'inventory-issue',
    name: 'Material Issue',
    path: '/inventory/issue',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  INVENTORY_ADJUSTMENT: {
    id: 'inventory-adjustment',
    name: 'Stock Adjustment',
    path: '/inventory/adjustment',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  INVENTORY_RETURN_SUPPLIER: {
    id: 'inventory-return-supplier',
    name: 'Return to Supplier',
    path: '/inventory/return-to-supplier',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  INVENTORY_BILL_PASSING: {
    id: 'inventory-bill-passing',
    name: 'Bill Passing',
    path: '/inventory/bill-passing',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  OPENING_STOCK: {
    id: 'opening-stock',
    name: 'Opening Stock Balance',
    path: '/inventory/opening-stock',
    group: 'transactions',
    linkedTo: 'inventory',
  },
  COSTING: {
    id: 'costing',
    name: 'Costing',
    path: '/costing',
    group: 'transactions',
  },
  COSTING_APPROVAL: {
    id: 'costing-approval',
    name: 'Costing Approval Actions',
    path: '/costing',
    group: 'transactions',
    linkedTo: 'costing',
  },
  REPORTS: {
    id: 'reports',
    name: 'Reports',
    path: '/reports',
    group: 'transactions',
  },
  BUYERS: {
    id: 'buyer-info',
    name: 'Buyers',
    path: '/master/buyers',
    group: 'master',
  },
  SUPPLIERS: {
    id: 'supplier-info',
    name: 'Suppliers',
    path: '/master/suppliers',
    group: 'master',
  },
  ITEMS: {
    id: 'items',
    name: 'Items',
    path: '/master/items',
    group: 'master',
  },
  MASTER_DATA: {
    id: 'master-data',
    name: 'Master Data',
    description: 'Categories, Sub-Categories, Item Types, UOM, Attributes',
    path: '/master',
    group: 'master',
  },
  STYLE_MASTER: {
    id: 'style-master',
    name: 'Style Master',
    path: '/master → Styles tab',
    group: 'master',
  },
  SIZE_PRESETS: {
    id: 'size-presets',
    name: 'Size Presets',
    path: '/master → Size Presets tab',
    group: 'master',
  },
  PAYMENT_TERMS_MASTER: {
    id: 'payment-terms',
    name: 'Payment Terms',
    path: '/master → Payment Terms tab',
    group: 'master',
  },
  TERMS_CONDITIONS: {
    id: 'terms-conditions',
    name: 'Terms & Conditions',
    path: '/master → Terms & Conditions tab',
    group: 'master',
  },
  PROCESS_MASTER: {
    id: 'process-master',
    name: 'Processes',
    path: '/master → Processes tab',
    group: 'master',
  },
  PARTS_MASTER: {
    id: 'parts-master',
    name: 'Parts Master',
    path: '/master → Parts tab',
    group: 'master',
  },
  OVERHEAD_MASTER: {
    id: 'overhead-master',
    name: 'Overheads',
    path: '/master → Overheads tab',
    group: 'master',
  },
  COURIERS: {
    id: 'couriers',
    name: 'Couriers',
    path: '/master → Couriers tab',
    group: 'master',
  },
  USERS: {
    id: 'users',
    name: 'Users',
    path: '/admin/users',
    group: 'admin',
  },
  ROLES: {
    id: 'roles',
    name: 'Role & Access',
    path: '/admin/roles',
    group: 'admin',
  },
  AI_ASSISTANT: {
    id: 'ai-assistant',
    name: 'AI Assistant',
    path: '/reports/ai-chat',
    group: 'transactions',
    linkedTo: 'reports',
  },
  APPROVAL_FLOWS: {
    id: 'approval-flows',
    name: 'Approval Flows',
    path: '/admin/approval-flows',
    group: 'admin',
  },
  COMPANY_PROFILE: {
    id: 'company-profile',
    name: 'Company Profile',
    path: '/admin/company-profile',
    group: 'admin',
  },
  // ── HR & Payroll ──
  HR_MASTERS: {
    id: 'hr-masters',
    name: 'HR Masters',
    path: '/hr/masters',
    group: 'hr',
  },
  HR_EMPLOYEES: {
    id: 'hr-employees',
    name: 'Employees',
    path: '/hr/employees',
    group: 'hr',
  },
  HR_ATTENDANCE: {
    id: 'hr-attendance',
    name: 'Attendance',
    path: '/hr/attendance',
    group: 'hr',
  },
  HR_LEAVE: {
    id: 'hr-leave',
    name: 'Leave Management',
    path: '/hr/leaves',
    group: 'hr',
  },
  HR_PAYROLL: {
    id: 'hr-payroll',
    name: 'Payroll',
    path: '/hr/payroll',
    group: 'hr',
  },
  HR_LOANS: {
    id: 'hr-loans',
    name: 'Loans & Advances',
    path: '/hr/loans',
    group: 'hr',
  },
  HR_BONUS: {
    id: 'hr-bonus',
    name: 'Bonus',
    path: '/hr/bonus',
    group: 'hr',
  },
  HR_STATUTORY: {
    id: 'hr-statutory',
    name: 'Statutory',
    path: '/hr/statutory',
    group: 'hr',
  },
  HR_FNF: {
    id: 'hr-fnf',
    name: 'F&F Settlement',
    path: '/hr/fnf',
    group: 'hr',
  },
};

// ─── OPERATION DEFINITIONS ─────────────────────────────────────────────────────

export const OPERATIONS = {
  VIEW: { id: 'view', name: 'View' },
  ADD: { id: 'add', name: 'Add' },
  UPDATE: { id: 'update', name: 'Update' },
  DELETE: { id: 'delete', name: 'Delete' },
  SUBMIT: { id: 'submit', name: 'Submit' },
  APPROVE: { id: 'approve', name: 'Approve' },
  REJECT: { id: 'reject', name: 'Reject' },
  CANCEL: { id: 'cancel', name: 'Cancel' },
  REFER_BACK: { id: 'refer_back', name: 'Refer Back' },
};

// Standard CRUD operations
export const STANDARD_OPERATIONS = ['view', 'add', 'update', 'delete'];

// Order Action operations
export const ORDER_ACTION_OPERATIONS = ['refer_back', 'cancel', 'approve', 'reject'];

// PO Approval operations
export const PO_APPROVAL_OPERATIONS = ['refer_back', 'cancel', 'approve', 'reject'];

// Bill Passing splits the clerk (add/update), the verifier (verify) and the
// approver (approve) across one module, the way inventory-qc already does.
export const BILL_PASSING_OPERATIONS = ['view', 'add', 'update', 'delete', 'verify', 'approve'];

// GRN approval-action operations — mirror exactly what the GRN helpers check:
// canApproveGRNReferBack → grn-approval.refer_back, canApproveGRNReversal → grn-reversal.approve
export const GRN_APPROVAL_OPERATIONS = ['refer_back'];
export const GRN_REVERSAL_OPERATIONS = ['approve'];

// Costing Approval operations
export const COSTING_APPROVAL_OPERATIONS = ['approve', 'revise'];

// Export documents (Packing List / Export Invoice) carry an approval lifecycle:
// maker (add/update), approver (approve), and the two post-approval powers the
// PRD separates — `revise` opens a new draft version of an approved document,
// `override` forces a non-default template version onto one document. Both are
// logged; neither is ordinary editing. Acknowledging a validation WARNing maps to
// `update`, not `override`: every role that may acknowledge already holds an edit
// right, whereas template override is approver-only.
// No `submit` op — repo-wide, Draft→Submitted is gated on `update`
// (see canSubmitOrder below, and Bill Passing).
export const EXPORT_DOC_OPERATIONS = ['view', 'add', 'update', 'delete', 'approve', 'revise', 'override'];

// Stickers have no approval of their own — they inherit the packing list's state,
// so there is nothing to add/update/delete. What varies is who may put ink on
// paper: `print` from an approved PL, `reprint` a carton/range (an audited
// exception), `override` to print from a still-Draft PL.
export const EXPORT_STICKER_OPERATIONS = ['view', 'print', 'reprint', 'override'];

// `publish` moves a Draft template to Active and retires the previous Active — the
// only act that can break the "exactly one Active per buyer/sub-client/doc-type"
// invariant, so it is separated from ordinary draft editing.
export const EXPORT_TEMPLATE_OPERATIONS = ['view', 'add', 'update', 'delete', 'publish'];

// Dashboard only has view
export const DASHBOARD_OPERATIONS = ['view'];

// ─── PERMISSION MATRIX GROUPED LAYOUT ──────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    key: 'main',
    label: 'General',
    icon: 'DashboardOutlined',
    modules: [
      { id: 'dashboard', name: 'Dashboard', operations: DASHBOARD_OPERATIONS },
    ],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    icon: 'ShoppingCartOutlined',
    modules: [
      { id: 'orders', name: 'Orders', operations: STANDARD_OPERATIONS, path: '/orders/list' },
      { id: 'order-actions', name: 'Order Approval Actions', operations: ORDER_ACTION_OPERATIONS, linkedTo: 'orders', path: '(within Orders)' },
      { id: 'bom', name: 'Bill of Materials', operations: STANDARD_OPERATIONS, path: '/bom/list' },
      { id: 'sample-requests', name: 'Sample Requests', operations: STANDARD_OPERATIONS, path: '/sample-requests/list' },
      { id: 'sample-dispatches', name: 'Sample Dispatches', operations: STANDARD_OPERATIONS, path: '/sample-requests/dispatches/list' },
      { id: 'sample-comments', name: 'Customer Comments', operations: STANDARD_OPERATIONS, path: '/sample-requests/comments' },
      { id: 'sample-invoices', name: 'Invoices (Samples)', operations: STANDARD_OPERATIONS, path: '/sample-requests/invoices/list' },
      { id: 'purchase-orders', name: 'Supplier PO', operations: STANDARD_OPERATIONS, path: '/purchase-orders/supplier-po/list' },
      { id: 'po-approval', name: 'PO Approval Actions', operations: PO_APPROVAL_OPERATIONS, linkedTo: 'purchase-orders', path: '(within Supplier PO)' },
      { id: 'cutting-po', name: 'Cutting PO', operations: STANDARD_OPERATIONS, path: '/purchase-orders/cutting-po/list' },
      { id: 'work-order', name: 'Work Orders', operations: STANDARD_OPERATIONS, path: '/purchase-orders/work-order/list' },
      { id: 'finishing-po', name: 'Finishing PO', operations: STANDARD_OPERATIONS, path: '/purchase-orders/finishing-po/list' },      { id: 'tna', name: 'Time & Action (TNA)', operations: STANDARD_OPERATIONS, path: '/tna/control-tower' },
      { id: 'tna-masters', name: 'TNA Masters', operations: STANDARD_OPERATIONS, path: '/tna/masters' },
      { id: 'tna-replan-approval', name: 'TNA Re-plan Approvals', operations: ['view', 'approve'], path: '/tna/replans' },
      { id: 'production-cutting', name: 'Production — Cutting', operations: STANDARD_OPERATIONS, path: '/production/cutting' },
      { id: 'production-sewing', name: 'Production — Sewing', operations: STANDARD_OPERATIONS, path: '/production/sewing' },
      { id: 'production-finishing', name: 'Production — Finishing', operations: STANDARD_OPERATIONS, path: '/production/finishing' },
      { id: 'export-packing', name: 'Carton Packing Entry', operations: STANDARD_OPERATIONS, path: '/export-docs/packing/list' },
      { id: 'export-shipments', name: 'Shipments', operations: STANDARD_OPERATIONS, path: '/export-docs/shipments/list' },
      { id: 'export-packing-list', name: 'Packing List', operations: EXPORT_DOC_OPERATIONS, path: '/export-docs/packing-lists/list' },
      { id: 'export-invoice', name: 'Export Invoice', operations: EXPORT_DOC_OPERATIONS, path: '/export-docs/invoices/list' },
      { id: 'export-stickers', name: 'Carton Stickers', operations: EXPORT_STICKER_OPERATIONS, linkedTo: 'export-packing-list', path: '/export-docs/stickers' },
      { id: 'export-templates', name: 'Buyer Document Templates', operations: EXPORT_TEMPLATE_OPERATIONS, path: '/export-docs/templates/list' },
      { id: 'production-masters', name: 'Production Masters', operations: STANDARD_OPERATIONS, path: '/production/masters' },
      { id: 'inventory', name: 'Inventory Management', operations: STANDARD_OPERATIONS, path: '/inventory/dashboard' },
      { id: 'grn-approval', name: 'GRN Refer-Back Approval', operations: GRN_APPROVAL_OPERATIONS, linkedTo: 'inventory', path: '(within GRN)' },
      { id: 'grn-reversal', name: 'GRN Reversal Approval', operations: GRN_REVERSAL_OPERATIONS, linkedTo: 'inventory', path: '(within GRN)' },
      { id: 'inventory-qc', name: 'Quality Control', operations: ['view', 'add', 'update', 'approve'], linkedTo: 'inventory', path: '/inventory/qc' },
      { id: 'inventory-issue', name: 'Material Issue', operations: ['view', 'add', 'update'], linkedTo: 'inventory', path: '/inventory/issue' },
      { id: 'inventory-adjustment', name: 'Stock Adjustment', operations: ['view', 'add', 'update', 'approve'], linkedTo: 'inventory', path: '/inventory/adjustment' },
      { id: 'inventory-return-supplier', name: 'Return to Supplier', operations: ['view', 'add'], linkedTo: 'inventory', path: '/inventory/return-to-supplier' },
      // verify = the Accounts Executive check; approve = the value-band approver.
      { id: 'inventory-bill-passing', name: 'Bill Passing', operations: BILL_PASSING_OPERATIONS, linkedTo: 'inventory', path: '/inventory/bill-passing' },
      { id: 'opening-stock', name: 'Opening Stock Balance', operations: ['view', 'add', 'update', 'post', 'finalize'], linkedTo: 'inventory', path: '/inventory/opening-stock' },
      { id: 'costing', name: 'Costing', operations: STANDARD_OPERATIONS, path: '/costing/list' },
      { id: 'costing-approval', name: 'Costing Approval Actions', operations: COSTING_APPROVAL_OPERATIONS, linkedTo: 'costing', path: '(within Costing)' },
      { id: 'reports', name: 'Reports & Analytics', operations: STANDARD_OPERATIONS, path: '/reports/list' },
      { id: 'ai-assistant', name: 'AI Assistant', operations: ['view'], linkedTo: 'reports', path: '/reports/ai-chat' },
    ],
  },
  {
    key: 'master',
    label: 'Master Data',
    icon: 'DatabaseOutlined',
    description: 'Individual access for Suppliers & Items; shared access for other master tabs',
    modules: [
      { id: 'buyer-info',      name: 'Buyers',                    description: 'Order Entry',          operations: STANDARD_OPERATIONS },
      { id: 'supplier-info',   name: 'Suppliers',                 description: 'Purchase Order',        operations: STANDARD_OPERATIONS },
      {
        id: 'master-data',
        name: 'Product Catalog',
        description: 'Item — Categories, Sub-Categories, Item Types, UOM, Attributes',
        operations: STANDARD_OPERATIONS,
      },
      { id: 'items',           name: 'Items',                     description: 'Purchase Order',        operations: ['view', 'add', 'update'] },
      { id: 'style-master',    name: 'Style Master',              description: 'Order Entry, Costing',  operations: STANDARD_OPERATIONS },
      { id: 'size-presets',    name: 'Size Presets',              description: 'Order Entry, Costing',  operations: STANDARD_OPERATIONS },
      { id: 'payment-terms',   name: 'Payment Terms',             description: 'Order Entry',           operations: STANDARD_OPERATIONS },
      { id: 'terms-conditions',name: 'Terms & Conditions',        description: 'Purchase Order',        operations: STANDARD_OPERATIONS },
      { id: 'process-master',  name: 'Processes',                  description: 'BOM, Manufacturing',    operations: STANDARD_OPERATIONS },
      { id: 'parts-master',    name: 'Parts Master',               description: 'BOM, Manufacturing',    operations: STANDARD_OPERATIONS },
      { id: 'overhead-master', name: 'Overheads',                  description: 'Costing, Shipment',     operations: STANDARD_OPERATIONS },
      { id: 'couriers',        name: 'Couriers',                   description: 'Sample Dispatch',       operations: STANDARD_OPERATIONS },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    icon: 'TeamOutlined',
    modules: [
      { id: 'hr-masters', name: 'HR Masters', operations: STANDARD_OPERATIONS, path: '/hr/masters' },
      { id: 'hr-employees', name: 'Employees', operations: STANDARD_OPERATIONS, path: '/hr/employees' },
      { id: 'hr-attendance', name: 'Attendance', operations: [...STANDARD_OPERATIONS, 'approve', 'reject', 'lock'], path: '/hr/attendance' },
      { id: 'hr-leave', name: 'Leave Management', operations: [...STANDARD_OPERATIONS, 'approve', 'reject'], path: '/hr/leaves' },
      { id: 'hr-payroll', name: 'Payroll', operations: [...STANDARD_OPERATIONS, 'approve', 'cancel'], path: '/hr/payroll' },
      { id: 'hr-loans', name: 'Loans & Advances', operations: STANDARD_OPERATIONS, path: '/hr/loans' },
      { id: 'hr-bonus', name: 'Bonus', operations: [...STANDARD_OPERATIONS, 'approve', 'cancel'], path: '/hr/bonus' },
      { id: 'hr-statutory', name: 'Statutory', operations: STANDARD_OPERATIONS, path: '/hr/statutory' },
      { id: 'hr-fnf', name: 'F&F Settlement', operations: [...STANDARD_OPERATIONS, 'approve'], path: '/hr/fnf' },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: 'SettingOutlined',
    modules: [
      { id: 'users', name: 'User Management', operations: STANDARD_OPERATIONS, path: '/admin/users' },
      { id: 'roles', name: 'Role & Access', operations: STANDARD_OPERATIONS, path: '/admin/roles' },
      { id: 'approval-flows', name: 'Approval Flows', operations: STANDARD_OPERATIONS, path: '/admin/approval-flows' },
      { id: 'company-profile', name: 'Company Profile', operations: ['view', 'add', 'update'], path: '/admin/company-profile' },
    ],
  },
];

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

export const getAllModules = () => Object.values(MODULES);
export const getAllOperations = () => Object.values(OPERATIONS);
export const getSidebarModules = () =>
  getAllModules().filter((m) => !['settings'].includes(m.id));

/** Returns which operations apply to a given module ID */
export const getOperationsForModule = (moduleId) => {
  if (moduleId === 'order-actions')   return ORDER_ACTION_OPERATIONS;
  if (moduleId === 'po-approval')     return PO_APPROVAL_OPERATIONS;
  if (moduleId === 'grn-approval')    return GRN_APPROVAL_OPERATIONS;
  if (moduleId === 'grn-reversal')    return GRN_REVERSAL_OPERATIONS;
  if (moduleId === 'costing-approval') return COSTING_APPROVAL_OPERATIONS;
  if (moduleId === 'dashboard')            return DASHBOARD_OPERATIONS;
  // Admins design reports in-app (create/edit/delete definitions); everyone else runs them
  if (moduleId === 'reports')              return STANDARD_OPERATIONS;
  if (moduleId === 'ai-assistant')        return ['view'];
  if (moduleId === 'inventory-qc')        return ['view', 'add', 'update', 'approve'];
  if (moduleId === 'inventory-issue')     return ['view', 'add', 'update'];
  if (moduleId === 'inventory-adjustment') return ['view', 'add', 'update', 'approve'];
  if (moduleId === 'inventory-return-supplier') return ['view', 'add'];
  // Attendance (miss punch, gate pass) and leave both have approve/reject
  // actions. Without declaring the operations here the permission keys are
  // never generated, so hasPermission(...,'approve') was undefined for every
  // role including admin, and the buttons could never appear for anyone.
  if (moduleId === 'hr-attendance')   return [...STANDARD_OPERATIONS, 'approve', 'reject', 'lock'];
  if (moduleId === 'hr-leave')        return [...STANDARD_OPERATIONS, 'approve', 'reject'];
  // Payroll and bonus move money, so approving and cancelling a run are gated
  // separately from ordinary editing. Without declaring them the keys are never
  // generated and hasPermission returns false for every role, admin included.
  if (moduleId === 'hr-payroll')      return [...STANDARD_OPERATIONS, 'approve', 'cancel'];
  if (moduleId === 'hr-bonus')        return [...STANDARD_OPERATIONS, 'approve', 'cancel'];
  if (moduleId === 'hr-fnf')          return [...STANDARD_OPERATIONS, 'approve'];
  if (moduleId === 'inventory-bill-passing') return BILL_PASSING_OPERATIONS;
  if (moduleId === 'export-packing')      return STANDARD_OPERATIONS;
  if (moduleId === 'export-shipments')    return STANDARD_OPERATIONS;
  if (moduleId === 'export-packing-list') return EXPORT_DOC_OPERATIONS;
  if (moduleId === 'export-invoice')      return EXPORT_DOC_OPERATIONS;
  if (moduleId === 'export-stickers')     return EXPORT_STICKER_OPERATIONS;
  if (moduleId === 'export-templates')    return EXPORT_TEMPLATE_OPERATIONS;
  // Items do not support delete via UI — remove 'delete' from operations
  if (moduleId === 'items')           return ['view', 'add', 'update'];
  return STANDARD_OPERATIONS;
};

// ─── EMPTY / ADMIN PERMISSION GENERATORS ───────────────────────────────────────

const buildPermissions = (defaultValue) => {
  const permissions = {};
  Object.values(MODULES).forEach((module) => {
    const ops = getOperationsForModule(module.id);
    permissions[module.id] = {
      access: defaultValue,
      operations: ops.reduce((acc, op) => {
        acc[op] = defaultValue;
        return acc;
      }, {}),
    };
  });
  return permissions;
};

export const getAdminPermissions = () => buildPermissions(true);
export const getEmptyPermissions = () => buildPermissions(false);

// ─── ROLE HELPERS ──────────────────────────────────────────────────────────────

export const isAdminRole = (role) => {
  if (!role) return false;
  try {
    const normalized = String(role).toLowerCase().replace(/[\s_-]+/g, '');
    return normalized === 'admin' || normalized === 'superadmin';
  } catch {
    return false;
  }
};

// ─── SESSION HELPERS ───────────────────────────────────────────────────────────
// Delegated to sessionStore for centralized, secure session management.
// This avoids direct sessionStorage access and ensures the token field
// is never persisted in browser storage.

import { getCachedUserDisplay, cacheUserDisplay } from '../services/auth/sessionStore';

export const getCurrentUser = () => getCachedUserDisplay();

export const setCurrentUser = (user) => cacheUserDisplay(user);

/**
 * Get current user permissions.
 * Normalizes the token's permission object against known modules
 * so any module added later has a safe fallback.
 */
export const getCurrentUserPermissions = () => {
  const user = getCurrentUser();

  if (isAdminRole(user?.role)) {
    return getAdminPermissions();
  }

  const raw = user?.permissions;
  if (!raw || typeof raw !== 'object') return getEmptyPermissions();

  // Merge raw permissions with empty template so every key exists
  const empty = getEmptyPermissions();
  const merged = { ...empty };
  Object.keys(raw).forEach((moduleId) => {
    if (merged[moduleId]) {
      merged[moduleId] = {
        access: !!raw[moduleId]?.access,
        operations: {
          ...merged[moduleId].operations,
          ...(raw[moduleId]?.operations || {}),
        },
      };
    } else {
      merged[moduleId] = raw[moduleId];
    }
  });
  return merged;
};

// ─── PERMISSION CHECK FUNCTIONS ────────────────────────────────────────────────

export const hasModuleAccess = (moduleId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  return permissions[moduleId].access === true;
};

export const hasPermission = (moduleId, operationId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  if (!permissions[moduleId].access) return false;
  return permissions[moduleId].operations?.[operationId] === true;
};

export const hasOperationPermission = hasPermission;

export const hasAllPermissions = (checks) => {
  return checks.every(({ module, operation }) => hasPermission(module, operation));
};

export const hasAnyPermission = (checks) => {
  return checks.some(({ module, operation }) => hasPermission(module, operation));
};

// ─── ORDER ACTION HELPERS (linked to Orders access) ────────────────────────────

// Submit = user has add OR update access on orders (no separate permission needed)
export const canSubmitOrder = () =>
  hasPermission('orders', 'add') || hasPermission('orders', 'update');

export const canReferBackOrder = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'refer_back');

export const canCancelOrder = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'cancel');

export const canApproveOrderAction = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'approve');

export const canRejectOrderAction = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'reject');

export const canPerformOrderActions = () =>
  hasModuleAccess('orders') &&
  (canReferBackOrder() || canCancelOrder());

// ─── PO APPROVAL HELPERS (linked to PO access) ────────────────────────────────

export const canApprovePO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'approve');

export const canRejectPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'reject');

export const canCancelPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'cancel');

export const canReferBackPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'refer_back');

export const canPerformApprovalActions = () =>
  hasModuleAccess('purchase-orders') &&
  (canApprovePO() || canRejectPO() || canCancelPO() || canReferBackPO());

// ─── GRN APPROVAL HELPERS (no approve/reject on GRN content; only on refer-back & reversal) ──

export const canRequestGRNReferBack = () =>
  hasModuleAccess('inventory');

export const canApproveGRNReferBack = () =>
  hasModuleAccess('inventory') && hasPermission('grn-approval', 'refer_back');

export const canRequestGRNReversal = () =>
  hasModuleAccess('inventory');

export const canApproveGRNReversal = () =>
  hasModuleAccess('inventory') && hasPermission('grn-reversal', 'approve');

// ─── QC APPROVAL HELPERS ────────────────────────────────────────────────────
// QC does not have a separate `qc-approval` sub-module (unlike PO / Orders /
// Costing). All approve/reject/refer-back actions are gated by the `approve`
// operation on the `inventory-qc` module itself, which is what the module
// registry at the top of this file declares for QC.

export const canApproveQC = () =>
  hasModuleAccess('inventory-qc') && hasPermission('inventory-qc', 'approve');

export const canRejectQC = () =>
  hasModuleAccess('inventory-qc') && hasPermission('inventory-qc', 'approve');

export const canRequestQCReferBack = () =>
  hasModuleAccess('inventory-qc') && hasPermission('inventory-qc', 'approve');

export const canApproveQCReferBack = () =>
  hasModuleAccess('inventory-qc') && hasPermission('inventory-qc', 'approve');

// ─── COSTING APPROVAL HELPERS (linked to Costing access) ────────────────────

export const canApproveCostSheet = () =>
  hasModuleAccess('costing') && hasPermission('costing-approval', 'approve');

export const canReviseCostSheet = () =>
  hasModuleAccess('costing') && hasPermission('costing-approval', 'revise');

// ─── FIRST ACCESSIBLE ROUTE ──────────────────────────────────────────────────

/**
 * Returns the first accessible route for the current user.
 * Used to redirect users who don't have dashboard permission.
 * Order matches the sidebar menu priority.
 */
export const getFirstAccessibleRoute = () => {
  const routeModuleMap = [
    { route: '/', moduleId: 'dashboard' },
    { route: '/orders/list', moduleId: 'orders' },
    { route: '/bom/list', moduleId: 'bom' },
    { route: '/sample-requests/list', moduleId: 'sample-requests' },
    { route: '/sample-requests/dispatches/list', moduleId: 'sample-dispatches' },
    { route: '/sample-requests/comments', moduleId: 'sample-comments' },
    { route: '/sample-requests/invoices/list', moduleId: 'sample-invoices' },
    { route: '/purchase-orders/supplier-po/list', moduleId: 'purchase-orders' },
    { route: '/purchase-orders/cutting-po/list', moduleId: 'cutting-po' },
    { route: '/purchase-orders/work-order/list', moduleId: 'work-order' },
    { route: '/purchase-orders/finishing-po/list', moduleId: 'finishing-po' },    { route: '/production/cutting', moduleId: 'production-cutting' },
    { route: '/production/sewing', moduleId: 'production-sewing' },
    { route: '/production/finishing', moduleId: 'production-finishing' },
    { route: '/export-docs/packing/list', moduleId: 'export-packing' },
    { route: '/export-docs/shipments/list', moduleId: 'export-shipments' },
    { route: '/export-docs/packing-lists/list', moduleId: 'export-packing-list' },
    { route: '/export-docs/invoices/list', moduleId: 'export-invoice' },
    { route: '/export-docs/stickers', moduleId: 'export-stickers' },
    { route: '/export-docs/templates/list', moduleId: 'export-templates' },
    { route: '/grn/list', moduleId: 'grn' },
    { route: '/costing/list', moduleId: 'costing' },
    { route: '/reports/list', moduleId: 'reports' },
    { route: '/master', moduleId: ['master-data', 'buyer-info', 'supplier-info', 'items', 'terms-conditions', 'overhead-master', 'couriers'] },
    { route: '/admin/dashboard', moduleId: ['users', 'roles', 'company-profile'] },
  ];

  for (const entry of routeModuleMap) {
    if (Array.isArray(entry.moduleId)) {
      if (entry.moduleId.some((id) => hasModuleAccess(id))) return entry.route;
    } else {
      if (hasModuleAccess(entry.moduleId)) return entry.route;
    }
  }

  return '/'; // fallback
};

// ─── PERMISSION VALIDATION ────────────────────────────────────────────────────

/**
 * Validate that at least one page permission is enabled for a role.
 * @returns {{ valid: boolean, message?: string }}
 */
export const validatePermissions = (permissions) => {
  if (!permissions || typeof permissions !== 'object') {
    return { valid: false, message: 'Permissions are required.' };
  }

  const hasAny = Object.values(permissions).some((mod) => mod.access === true);

  if (!hasAny) {
    return {
      valid: false,
      message: 'At least one page permission must be enabled for a role.',
    };
  }

  return { valid: true };
};

/**
 * Normalize permissions before saving to API.
 * Ensures only known modules with their applicable operations are saved.
 * Enforces PO-approval → PO link: if PO has no access, approval is disabled.
 */
export const normalizePermissionsForSave = (permissions) => {
  const normalized = {};

  Object.values(MODULES).forEach((module) => {
    const modulePerms = permissions[module.id];
    const ops = getOperationsForModule(module.id);

    const operations = {};
    ops.forEach((op) => {
      operations[op] = !!(modulePerms?.operations?.[op]);
    });

    const access = Object.values(operations).some(Boolean);
    normalized[module.id] = { access, operations };
  });

  // Enforce order-actions → orders link
  if (!normalized['orders']?.access) {
    normalized['order-actions'] = {
      access: false,
      operations: ORDER_ACTION_OPERATIONS.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  }

  // Enforce PO-approval → PO link
  if (!normalized['purchase-orders']?.access) {
    normalized['po-approval'] = {
      access: false,
      operations: PO_APPROVAL_OPERATIONS.reduce((acc, op) => {
        acc[op] = false;
        return acc;
      }, {}),
    };
  }

  // Enforce costing-approval → costing link (mirrors order-actions and po-approval pattern)
  if (!normalized['costing']?.access) {
    normalized['costing-approval'] = {
      access: false,
      operations: COSTING_APPROVAL_OPERATIONS.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  }

  // Enforce ai-assistant → reports link
  if (!normalized['reports']?.access) {
    normalized['ai-assistant'] = {
      access: false,
      operations: { view: false },
    };
  }

  // Enforce export-stickers → export-packing-list link. Stickers are a projection
  // of an approved packing list; without PL access there is nothing to render.
  if (!normalized['export-packing-list']?.access) {
    normalized['export-stickers'] = {
      access: false,
      operations: EXPORT_STICKER_OPERATIONS.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  }

  return normalized;
};
