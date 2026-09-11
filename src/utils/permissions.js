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

// ─── SECTIONS ───────────────────────────────────────────────────────────────
//
// One section per top-level sidebar group, so the permission matrix and the
// navigation an admin already knows are the same shape. The previous layout put
// 38 of the 64 screens into a single "Transactions" bucket, which is what made
// the matrix unreadable as screens kept arriving.
//
// `icon` names an @ant-design/icons export; the matrix resolves it through its
// own map, and assertRegistryIntegrity checks every name is present there.

export const SECTIONS = [
  { key: 'dashboard',  label: 'Dashboard',            icon: 'DashboardOutlined' },
  { key: 'orders',     label: 'Orders',               icon: 'ShoppingCartOutlined' },
  { key: 'bom',        label: 'Bill of Materials',    icon: 'FileTextOutlined' },
  { key: 'costing',    label: 'Costing',              icon: 'DollarOutlined' },
  { key: 'purchase',   label: 'Purchase Orders',      icon: 'ShoppingOutlined' },
  { key: 'samples',    label: 'Sample Requests',      icon: 'ExperimentOutlined' },
  { key: 'inventory',  label: 'Inventory',            icon: 'AppstoreOutlined' },
  { key: 'production', label: 'Production',           icon: 'ScissorOutlined' },
  { key: 'tna',        label: 'Time & Action',        icon: 'FieldTimeOutlined' },
  { key: 'expdoc',     label: 'Export Documentation', icon: 'ContainerOutlined' },
  { key: 'master',     label: 'Master Data',          icon: 'DatabaseOutlined',
    description: 'Every tab of the Master Data workspace is granted separately.' },
  { key: 'reports',    label: 'Reports',              icon: 'BarChartOutlined' },
  { key: 'hr',         label: 'HR & Payroll',         icon: 'TeamOutlined' },
  { key: 'admin',      label: 'Administration',       icon: 'SettingOutlined' },
];

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

// Export documents (Packing List / Export Invoice) have NO approver: whoever
// builds a document finalises it, so there is no `approve` op. What remains are
// the maker rights (add/update) and the two post-finalise powers the PRD
// separates — `revise` opens a new draft version of a final document, `override`
// forces a non-default template version onto one document. Both are logged;
// neither is ordinary editing. Acknowledging a validation WARNing maps to
// `update`: every role that may acknowledge already holds an edit right.
// No `finalise` op — repo-wide, leaving Draft is gated on `update`
// (see canSubmitOrder below, and Bill Passing).
export const EXPORT_DOC_OPERATIONS = ['view', 'add', 'update', 'delete', 'revise', 'override'];

// Stickers have no lifecycle of their own — they inherit the packing list's
// state, so there is nothing to add/update/delete. What varies is who may put ink
// on paper: `print` from a final PL, `reprint` a carton/range (an audited
// exception), `override` to print from a still-Draft PL.
export const EXPORT_STICKER_OPERATIONS = ['view', 'print', 'reprint', 'override'];

// `publish` moves a Draft template to Active and retires the previous Active — the
// only act that can break the "exactly one Active per buyer/sub-client/doc-type"
// invariant, so it is separated from ordinary draft editing.
export const EXPORT_TEMPLATE_OPERATIONS = ['view', 'add', 'update', 'delete', 'publish'];

// Dashboard only has view
export const DASHBOARD_OPERATIONS = ['view'];

// ─── SCREEN REGISTRY ───────────────────────────────────────────────────────────
//
// ONE ENTRY PER URL-ADDRESSABLE SCREEN. This array is the single source of
// truth: MODULES, PERMISSION_GROUPS and getOperationsForModule are all derived
// from it below. Adding a screen means adding one row here and nothing else.
//
// Before this existed the same 64 screens were declared in four parallel lists
// that had to be hand-synced, and they had drifted: three screens declared one
// operation set in the matrix layout and a different one in the if-ladder that
// actually decided which checkboxes rendered.
//
//   id        REQUIRED  The key persisted in sys_roles.permissions (jsonb).
//                       NEVER rename without a Flyway backfill — see
//                       erp-purchase V29__split_production_rbac.sql.
//   name      REQUIRED  Label shown in the permission matrix.
//   section   REQUIRED  A SECTIONS[].key.
//   kind      REQUIRED  'dashboard' — read-only landing; ops must be ['view'].
//                       'screen'    — an ordinary routed screen.
//                       'tab'       — lives inside a shell page (e.g. /master).
//                       'approval'  — no route of its own; a bundle of rights
//                                     attached to the screen named by `requires`.
//   path      REQUIRED unless kind is 'approval'. The canonical landing route,
//                       and it must match a real <Route> in App.jsx.
//   routes    optional  Every route this key gates, when it gates more than one.
//   ops       REQUIRED  The authoritative operation list.
//   opLabels  optional  Per-screen label override, e.g. { delete: 'Cancel GRN' }.
//   requires  optional  A hard dependency on another screen, declared ONLY where
//                       the code actually enforces one.
//   description optional One line, shown muted under the name.
//
// Order matters: buildPermissions walks this array, so it fixes the key order of
// the persisted jsonb.

export const SCREENS = [
  // ── Dashboard ──
  { id: 'dashboard', name: 'Dashboard', section: 'dashboard', kind: 'dashboard',
    path: '/', ops: DASHBOARD_OPERATIONS },

  // ── Orders ──
  { id: 'orders', name: 'Orders', section: 'orders', kind: 'screen',
    path: '/orders/list', routes: ['/orders/list', '/orders/new', '/orders/edit/:id'],
    ops: STANDARD_OPERATIONS },

  // ── Bill of Materials ──
  { id: 'bom', name: 'Bill of Materials', section: 'bom', kind: 'screen',
    path: '/bom/list', routes: ['/bom/list', '/bom/new', '/bom/edit/:id'],
    ops: STANDARD_OPERATIONS },

  // ── Sample Requests ──
  { id: 'sample-requests', name: 'Sample Requests', section: 'samples', kind: 'screen',
    path: '/sample-requests/list',
    routes: ['/sample-requests/list', '/sample-requests/new', '/sample-requests/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'sample-dispatches', name: 'Sample Dispatches', section: 'samples', kind: 'screen',
    path: '/sample-requests/dispatches/list',
    routes: ['/sample-requests/dispatches/list', '/sample-requests/dispatches/new', '/sample-requests/dispatches/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'sample-comments', name: 'Customer Comments', section: 'samples', kind: 'screen',
    path: '/sample-requests/comments', ops: STANDARD_OPERATIONS },
  { id: 'sample-invoices', name: 'Invoices (Samples)', section: 'samples', kind: 'screen',
    path: '/sample-requests/invoices/list',
    routes: ['/sample-requests/invoices/list', '/sample-requests/invoices/new', '/sample-requests/invoices/edit/:id'],
    ops: STANDARD_OPERATIONS },

  // ── Purchase Orders ──
  { id: 'purchase-orders', name: 'Supplier PO', section: 'purchase', kind: 'screen',
    path: '/purchase-orders/supplier-po/list',
    routes: ['/purchase-orders/supplier-po/list', '/purchase-orders/supplier-po/new', '/purchase-orders/supplier-po/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'order-actions', name: 'Order Approval Actions', section: 'orders', kind: 'approval',
    requires: 'orders', ops: ORDER_ACTION_OPERATIONS,
    description: 'Act on an order awaiting approval, from inside the Orders screen.' },
  { id: 'po-approval', name: 'PO Approval Actions', section: 'purchase', kind: 'approval',
    requires: 'purchase-orders', ops: PO_APPROVAL_OPERATIONS,
    description: 'Act on a Supplier PO awaiting approval.' },
  { id: 'grn-approval', name: 'GRN Refer-Back Approval', section: 'inventory', kind: 'approval',
    requires: 'inventory', ops: GRN_APPROVAL_OPERATIONS },
  { id: 'grn-reversal', name: 'GRN Reversal Approval', section: 'inventory', kind: 'approval',
    requires: 'inventory', ops: GRN_REVERSAL_OPERATIONS },
  { id: 'cutting-po', name: 'Cutting PO', section: 'purchase', kind: 'screen',
    path: '/purchase-orders/cutting-po/list',
    routes: ['/purchase-orders/cutting-po/list', '/purchase-orders/cutting-po/new', '/purchase-orders/cutting-po/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'work-order', name: 'Work Orders', section: 'purchase', kind: 'screen',
    path: '/purchase-orders/work-order/list',
    routes: ['/purchase-orders/work-order/list', '/purchase-orders/work-order/new', '/purchase-orders/work-order/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'finishing-po', name: 'Finishing PO', section: 'purchase', kind: 'screen',
    path: '/purchase-orders/finishing-po/list',
    routes: ['/purchase-orders/finishing-po/list', '/purchase-orders/finishing-po/new', '/purchase-orders/finishing-po/edit/:id'],
    ops: STANDARD_OPERATIONS },

  // ── Time & Action ──
  { id: 'tna', name: 'Time & Action', section: 'tna', kind: 'screen',
    path: '/tna/control-tower',
    routes: ['/tna/control-tower', '/tna/my-activities', '/tna/analytics', '/tna/plan/:planId'],
    ops: STANDARD_OPERATIONS },
  { id: 'tna-masters', name: 'TNA Masters', section: 'tna', kind: 'screen',
    path: '/tna/masters', ops: STANDARD_OPERATIONS },
  { id: 'tna-replan-approval', name: 'TNA Re-plan Approvals', section: 'tna', kind: 'screen',
    path: '/tna/replans', ops: STANDARD_OPERATIONS },

  // ── Production ──
  { id: 'production-cutting', name: 'Production — Cutting', section: 'production', kind: 'screen',
    path: '/production/cutting',
    routes: ['/production/cutting', '/production/cutting/marker-plan/new', '/production/cutting/marker-plan/:id',
             '/production/cutting/lay-audit/new', '/production/cutting/lay-audit/:id',
             '/production/cutting/tmb/new', '/production/cutting/tmb/:id',
             '/production/cutting/panel-check/new', '/production/cutting/panel-check/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'production-sewing', name: 'Production — Sewing', section: 'production', kind: 'screen',
    path: '/production/sewing',
    routes: ['/production/sewing', '/production/sewing/plan/new', '/production/sewing/plan/:id',
             '/production/sewing/measurement/new', '/production/sewing/measurement/:id',
             '/production/sewing/topse/new', '/production/sewing/topse/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'production-finishing', name: 'Production — Finishing', section: 'production', kind: 'screen',
    path: '/production/finishing',
    routes: ['/production/finishing', '/production/finishing/checking/new', '/production/finishing/checking/:id'],
    ops: STANDARD_OPERATIONS },

  // ── Export Documentation ──
  { id: 'export-packing', name: 'Carton Packing Entry', section: 'expdoc', kind: 'screen',
    path: '/export-docs/packing/list',
    routes: ['/export-docs/packing/list', '/export-docs/packing/new', '/export-docs/packing/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'export-shipments', name: 'Shipments', section: 'expdoc', kind: 'screen',
    path: '/export-docs/shipments/list',
    routes: ['/export-docs/shipments/list', '/export-docs/shipments/new', '/export-docs/shipments/edit/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'export-packing-list', name: 'Packing List', section: 'expdoc', kind: 'screen',
    path: '/export-docs/packing-lists/list',
    routes: ['/export-docs/packing-lists/list', '/export-docs/packing-lists/edit/:id',
             '/export-docs/reports', '/export-docs/audit'],
    ops: EXPORT_DOC_OPERATIONS,
    description: 'Also gates the export reports and the audit trail.' },
  { id: 'export-invoice', name: 'Export Invoice', section: 'expdoc', kind: 'screen',
    path: '/export-docs/invoices/list',
    routes: ['/export-docs/invoices/list', '/export-docs/invoices/edit/:id'],
    ops: EXPORT_DOC_OPERATIONS },
  { id: 'export-stickers', name: 'Carton Stickers', section: 'expdoc', kind: 'screen',
    path: '/export-docs/stickers', routes: ['/export-docs/stickers', '/export-docs/stickers/:plId'],
    requires: 'export-packing-list', ops: EXPORT_STICKER_OPERATIONS },
  { id: 'export-templates', name: 'Buyer Document Templates', section: 'expdoc', kind: 'screen',
    path: '/export-docs/templates/list',
    routes: ['/export-docs/templates/list', '/export-docs/templates/edit/:id'],
    ops: EXPORT_TEMPLATE_OPERATIONS },

  // ── Production masters (routed under /production, listed in the Production section) ──
  { id: 'production-masters', name: 'Production Masters', section: 'production', kind: 'screen',
    path: '/production/masters', ops: STANDARD_OPERATIONS },

  // ── Inventory ──
  //
  // One key used to gate four unrelated screens: a read-only KPI dashboard, the
  // GRN register with full CRUD, and the read-only stock register. So the
  // dashboard row offered Add, Update and Delete, none of which it can do, and
  // there was no way to let someone read stock without also letting them raise
  // a GRN. Split per the one-key-per-screen rule; `inventory` keeps its id so
  // no stored role loses its GRN rights.
  { id: 'inventory-dashboard', name: 'Inventory Dashboard', section: 'inventory', kind: 'dashboard',
    path: '/inventory/dashboard', ops: ['view'],
    description: 'Read-only stock and GRN indicators.' },
  // `cancel` reverses a posted GRN and `delete` removes a draft. Cancel used to
  // ride on the delete operation while the Delete button itself was gated by
  // nothing at all, so the checkbox named Delete authorised Cancel and actual
  // deletion was free. They are separate rights now.
  { id: 'inventory', name: 'GRN Register', section: 'inventory', kind: 'screen',
    path: '/inventory/grn/list',
    routes: ['/inventory/grn/list', '/inventory/grn/allowance',
             '/inventory/grn/fabric/new', '/inventory/grn/fabric/edit/:id',
             '/inventory/grn/accessories/new', '/inventory/grn/accessories/edit/:id'],
    ops: ['view', 'add', 'update', 'delete', 'cancel'],
    opLabels: { delete: 'Delete draft', cancel: 'Cancel GRN' },
    description: 'Goods receipt notes and the GRN allowance report.' },
  { id: 'inventory-stock', name: 'Stock Register', section: 'inventory', kind: 'screen',
    path: '/inventory/stock', ops: ['view'],
    description: 'Read-only stock balances.' },
  { id: 'inventory-qc', name: 'Quality Control', section: 'inventory', kind: 'screen',
    path: '/inventory/qc',
    routes: ['/inventory/qc', '/inventory/qc/fabric/new', '/inventory/qc/fabric/:id',
             '/inventory/qc/trims/new', '/inventory/qc/trims/:id'],
    ops: ['view', 'add', 'update', 'approve'] },
  { id: 'inventory-issue', name: 'Material Issue', section: 'inventory', kind: 'screen',
    path: '/inventory/issue',
    routes: ['/inventory/issue', '/inventory/issue/fabric/new', '/inventory/issue/fabric/:id',
             '/inventory/issue/accessories/new', '/inventory/issue/accessories/:id',
             '/inventory/issue/sample/fabric/new', '/inventory/issue/sample/trims/new'],
    ops: ['view', 'add', 'update'] },
  { id: 'inventory-adjustment', name: 'Stock Adjustment', section: 'inventory', kind: 'screen',
    path: '/inventory/adjustment',
    routes: ['/inventory/adjustment', '/inventory/adjustment/new', '/inventory/adjustment/:id'],
    ops: ['view', 'add', 'update', 'approve'] },
  { id: 'inventory-return-supplier', name: 'Return to Supplier', section: 'inventory', kind: 'screen',
    path: '/inventory/return-to-supplier', ops: ['view', 'add'] },
  // verify = the Accounts Executive check; approve = the value-band approver.
  { id: 'inventory-bill-passing', name: 'Bill Passing', section: 'inventory', kind: 'screen',
    path: '/inventory/bill-passing',
    routes: ['/inventory/bill-passing', '/inventory/bill-passing/:id'],
    ops: BILL_PASSING_OPERATIONS },
  // `post` commits a batch to stock, `finalize` locks the cut-over for good.
  // Both are checked by the screens (OpeningStockBatchForm:54, Dashboard:83) but
  // the old if-ladder never returned them, so the buttons they gate were hidden
  // from every role including Super Admin, whose map is built from the same list.
  // `delete` goes the other way: it was offered and nothing ever read it.
  { id: 'opening-stock', name: 'Opening Stock Balance', section: 'inventory', kind: 'screen',
    path: '/inventory/opening-stock',
    routes: ['/inventory/opening-stock', '/inventory/opening-stock/fabric/new', '/inventory/opening-stock/fabric/:id',
             '/inventory/opening-stock/accessories/new', '/inventory/opening-stock/accessories/:id'],
    ops: ['view', 'add', 'update', 'post', 'finalize'],
    description: 'Post commits a batch to stock; Finalize locks the cut-over.' },

  // ── Costing ──
  { id: 'costing', name: 'Costing', section: 'costing', kind: 'screen',
    path: '/costing/list',
    routes: ['/costing/list', '/costing/new', '/costing/edit/:id', '/costing/compare', '/costing/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'costing-approval', name: 'Costing Approval Actions', section: 'costing', kind: 'approval',
    requires: 'costing', ops: COSTING_APPROVAL_OPERATIONS },

  // ── Reports ──
  { id: 'reports', name: 'Reports & Analytics', section: 'reports', kind: 'screen',
    path: '/reports/list', routes: ['/reports/list', '/reports/builder/:id', '/reports/saved'],
    ops: STANDARD_OPERATIONS },

  // ── Master Data — every entry is a tab inside the /master workspace ──
  { id: 'buyer-info', name: 'Buyers', section: 'master', kind: 'tab',
    path: '/master', description: 'Order Entry', ops: STANDARD_OPERATIONS },
  { id: 'supplier-info', name: 'Suppliers', section: 'master', kind: 'tab',
    path: '/master', description: 'Purchase Order', ops: STANDARD_OPERATIONS },
  { id: 'items', name: 'Items', section: 'master', kind: 'tab',
    path: '/master', description: 'Purchase Order', ops: ['view', 'add', 'update'] },
  { id: 'master-data', name: 'Product Catalog', section: 'master', kind: 'tab',
    path: '/master', description: 'Categories, Sub-Categories, Item Types, UOM, Attributes',
    ops: STANDARD_OPERATIONS },
  { id: 'style-master', name: 'Style Master', section: 'master', kind: 'tab',
    path: '/master', description: 'Order Entry, Costing', ops: STANDARD_OPERATIONS },
  { id: 'size-presets', name: 'Size Presets', section: 'master', kind: 'tab',
    path: '/master', description: 'Order Entry, Costing', ops: STANDARD_OPERATIONS },
  { id: 'payment-terms', name: 'Payment Terms', section: 'master', kind: 'tab',
    path: '/master', description: 'Order Entry', ops: STANDARD_OPERATIONS },
  { id: 'terms-conditions', name: 'Terms & Conditions', section: 'master', kind: 'tab',
    path: '/master', description: 'Purchase Order', ops: STANDARD_OPERATIONS },
  { id: 'process-master', name: 'Processes', section: 'master', kind: 'tab',
    path: '/master', description: 'BOM, Manufacturing', ops: STANDARD_OPERATIONS },
  { id: 'parts-master', name: 'Parts Master', section: 'master', kind: 'tab',
    path: '/master', description: 'BOM, Manufacturing', ops: STANDARD_OPERATIONS },
  { id: 'overhead-master', name: 'Overheads', section: 'master', kind: 'tab',
    path: '/master', description: 'Costing, Shipment', ops: STANDARD_OPERATIONS },
  { id: 'couriers', name: 'Couriers', section: 'master', kind: 'tab',
    path: '/master', description: 'Sample Dispatch', ops: STANDARD_OPERATIONS },

  // ── Administration ──
  { id: 'users', name: 'User Management', section: 'admin', kind: 'screen',
    path: '/admin/users', ops: STANDARD_OPERATIONS },
  { id: 'roles', name: 'Role & Access', section: 'admin', kind: 'screen',
    path: '/admin/roles', ops: STANDARD_OPERATIONS },
  { id: 'ai-assistant', name: 'AI Assistant', section: 'reports', kind: 'screen',
    path: '/reports/ai-chat', requires: 'reports', ops: ['view'] },
  { id: 'approval-flows', name: 'Approval Flows', section: 'admin', kind: 'screen',
    path: '/admin/approval-flows', ops: STANDARD_OPERATIONS },
  { id: 'company-profile', name: 'Company Profile', section: 'admin', kind: 'screen',
    path: '/admin/company-profile', ops: STANDARD_OPERATIONS },

  // ── HR & Payroll ──
  { id: 'hr-masters', name: 'HR Masters', section: 'hr', kind: 'screen',
    path: '/hr/masters', ops: STANDARD_OPERATIONS },
  { id: 'hr-employees', name: 'Employees', section: 'hr', kind: 'screen',
    path: '/hr/employees',
    routes: ['/hr/employees', '/hr/employees/new', '/hr/employees/edit/:id', '/hr/employees/:id'],
    ops: STANDARD_OPERATIONS },
  { id: 'hr-attendance', name: 'Attendance', section: 'hr', kind: 'screen',
    path: '/hr/attendance/calendar',
    routes: ['/hr/attendance/calendar', '/hr/attendance/bulk', '/hr/attendance/entry',
             '/hr/attendance/import', '/hr/attendance/miss-punch', '/hr/attendance/gate-pass'],
    ops: [...STANDARD_OPERATIONS, 'approve', 'reject', 'lock'] },
  { id: 'hr-leave', name: 'Leave Management', section: 'hr', kind: 'screen',
    path: '/hr/leaves', routes: ['/hr/leaves', '/hr/leaves/balances'],
    ops: [...STANDARD_OPERATIONS, 'approve', 'reject'] },
  { id: 'hr-payroll', name: 'Payroll', section: 'hr', kind: 'screen',
    path: '/hr/payroll',
    routes: ['/hr/payroll', '/hr/payroll/new', '/hr/payroll/slip/:id', '/hr/payroll/:id'],
    ops: [...STANDARD_OPERATIONS, 'approve', 'cancel'] },
  { id: 'hr-loans', name: 'Loans & Advances', section: 'hr', kind: 'screen',
    path: '/hr/loans', routes: ['/hr/loans', '/hr/loans/:id', '/hr/advances'],
    ops: STANDARD_OPERATIONS },
  { id: 'hr-bonus', name: 'Bonus', section: 'hr', kind: 'screen',
    path: '/hr/bonus', routes: ['/hr/bonus', '/hr/bonus/new', '/hr/bonus/:id'],
    ops: [...STANDARD_OPERATIONS, 'approve', 'cancel'] },
  { id: 'hr-statutory', name: 'Statutory', section: 'hr', kind: 'screen',
    path: '/hr/statutory/pt',
    routes: ['/hr/statutory/pt', '/hr/statutory/pt/:id', '/hr/statutory/el', '/hr/statutory/el/:id',
             '/hr/statutory/pf', '/hr/statutory/esi'],
    ops: STANDARD_OPERATIONS },
  { id: 'hr-fnf', name: 'F&F Settlement', section: 'hr', kind: 'screen',
    path: '/hr/fnf', routes: ['/hr/fnf', '/hr/fnf/new', '/hr/fnf/edit/:id', '/hr/fnf/:id'],
    ops: [...STANDARD_OPERATIONS, 'approve'] },
  // Read-only, but a separate module from hr-payroll on purpose: seeing what a
  // factory's wage bill did is a wider grant than running its payroll, and some
  // people need one without the other.
  { id: 'hr-analytics', name: 'HR Analytics', section: 'hr', kind: 'screen',
    path: '/hr/analytics', ops: ['view'] },
  // Self-service: only ever the signed-in employee's own records, which is
  // enforced on the server. Separate from every other hr-* module because it
  // grants nothing about anybody else, and is the one module a shop-floor
  // worker should hold.
  { id: 'hr-ess', name: 'My HR', section: 'hr', kind: 'screen',
    path: '/ess', ops: ['view'] },
];

const SCREEN_BY_ID = SCREENS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

// ─── DERIVED VIEWS ─────────────────────────────────────────────────────────────
// Everything below is generated from SCREENS. Do not hand-edit — change the
// registry instead.

/**
 * Legacy module registry, keyed by module id.
 *
 * Was a hand-written object literal keyed by UPPER_SNAKE names. Nothing outside
 * this file ever imported it by name; the only real uses are the
 * `Object.values(MODULES)` walks in buildPermissions and
 * normalizePermissionsForSave, which are unaffected by the key change.
 */
export const MODULES = Object.freeze(
  SCREENS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}),
);

/** Grouped layout consumed by the permission matrix. */
export const PERMISSION_GROUPS = SECTIONS.map((section) => ({
  key: section.key,
  label: section.label,
  icon: section.icon,
  description: section.description,
  modules: SCREENS.filter((s) => s.section === section.key).map((s) => ({
    id: s.id,
    name: s.name,
    path: s.path,
    description: s.description,
    operations: s.ops,
    kind: s.kind,
    requires: s.requires,
    opLabels: s.opLabels,
  })),
}));

/** Sections with their screens attached — the matrix data source. */
export const getPermissionSections = () =>
  SECTIONS.map((section) => ({
    ...section,
    screens: SCREENS.filter((s) => s.section === section.key),
  }));

/**
 * Registry self-check, dev builds only.
 *
 * Every failure listed here is a drift class that actually happened while the
 * registry was four hand-synced lists: an operation the matrix offered but no
 * code read, an operation the code read but the matrix never rendered, a screen
 * filed under a section that did not exist, a dashboard row offering add/edit/
 * delete. Failing loudly at boot is cheaper than finding it in production.
 */
export const assertRegistryIntegrity = () => {
  const problems = [];
  const sectionKeys = new Set(SECTIONS.map((s) => s.key));
  const seen = new Set();

  SCREENS.forEach((s) => {
    if (seen.has(s.id)) problems.push(`duplicate screen id "${s.id}"`);
    seen.add(s.id);

    if (!sectionKeys.has(s.section)) problems.push(`"${s.id}" is in unknown section "${s.section}"`);
    if (!Array.isArray(s.ops) || s.ops.length === 0) problems.push(`"${s.id}" declares no operations`);
    if (new Set(s.ops).size !== s.ops.length) problems.push(`"${s.id}" repeats an operation`);

    if (s.kind === 'approval') {
      if (s.path) problems.push(`"${s.id}" is an approval bundle but declares a path`);
      if (!s.requires) problems.push(`"${s.id}" is an approval bundle but requires nothing`);
    } else if (!s.path) {
      problems.push(`"${s.id}" is a ${s.kind} but declares no path`);
    }

    // A dashboard is a read-only landing. Offering add/update/delete on one is
    // the exact complaint that started this work.
    if (s.kind === 'dashboard' && (s.ops.length !== 1 || s.ops[0] !== 'view')) {
      problems.push(`dashboard "${s.id}" must declare exactly ['view'], got [${s.ops}]`);
    }

    if (s.requires) {
      const parent = SCREEN_BY_ID[s.requires];
      if (!parent) problems.push(`"${s.id}" requires unknown screen "${s.requires}"`);
      else if (parent.kind === 'approval') problems.push(`"${s.id}" requires "${s.requires}", which is itself an approval bundle`);
    }
  });

  if (problems.length) {
    console.error(
      `[permissions] registry integrity: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`,
    );
  }
  return problems;
};

if (import.meta.env?.DEV) assertRegistryIntegrity();

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

export const getAllModules = () => Object.values(MODULES);
export const getAllOperations = () => Object.values(OPERATIONS);
export const getSidebarModules = () =>
  getAllModules().filter((m) => !['settings'].includes(m.id));

/**
 * Returns which operations apply to a given module ID.
 *
 * Was a 23-branch if-ladder that had to be kept in step with the matrix layout
 * by hand, and had drifted from it for three screens. Now a lookup into SCREENS.
 * The STANDARD_OPERATIONS fallback is deliberate: a legacy key still present in
 * a stored role must normalize rather than throw.
 */
export const getOperationsForModule = (moduleId) =>
  SCREEN_BY_ID[moduleId]?.ops ?? STANDARD_OPERATIONS;

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
  // Derived from the registry, in section order. The hand-written table this
  // replaces listed 25 of the 64 screens, so a role holding only HR, inventory,
  // TNA, production-masters or approval-flows keys matched nothing and fell
  // through to '/' — the company dashboard it had no permission for. It also
  // carried a dead '/grn/list' entry for a module id that does not exist.
  for (const section of SECTIONS) {
    for (const screen of SCREENS) {
      if (screen.section !== section.key) continue;
      if (screen.kind === 'approval') continue; // no route of its own
      if (screen.path && hasModuleAccess(screen.id)) return screen.path;
    }
  }

  // Nothing at all is accessible. Profile is self-scoped and always reachable,
  // so it beats returning '/' and rendering a dashboard the user cannot hold.
  return '/profile';
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
 * Clear any screen whose `requires` parent has no access.
 *
 * The single enforcement point for dependencies. The rules used to live in three
 * places with three different memberships: the matrix UI honoured four pairs,
 * this normalizer enforced five, and the registry declared thirteen. The pair it
 * enforced but the UI did not - stickers needing a packing list - meant an admin
 * could tick Print, save successfully, reopen, and find it silently off.
 *
 * Returns a new object; the input is not mutated.
 */
export const applyDependencies = (permissions) => {
  const out = { ...permissions };
  SCREENS.forEach((screen) => {
    if (!screen.requires) return;
    if (out[screen.requires]?.access) return;
    out[screen.id] = {
      access: false,
      operations: screen.ops.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  });
  return out;
};

/**
 * Why a screen cannot be granted right now, or null if it can.
 * Used by the matrix to disable a row and say what would unblock it.
 */
export const getBlockedReason = (screenId, permissions) => {
  const screen = SCREEN_BY_ID[screenId];
  if (!screen?.requires) return null;
  if (permissions?.[screen.requires]?.access) return null;
  return { requiresId: screen.requires, requiresName: SCREEN_BY_ID[screen.requires]?.name ?? screen.requires };
};

/**
 * Normalize permissions before saving to API.
 * Ensures only known modules with their applicable operations are saved, then
 * applies the registry's dependency rules.
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

  return applyDependencies(normalized);
};
