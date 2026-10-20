/**
 * ERP business events and how the factory shows them. Priority decides the strength of the
 * visual: high = toast + strong animation, medium = movement + ticker, low = ticker only.
 * `visual` names the scene effect the director plays (see scene/effects).
 */
export const EVENT_KINDS = {
  ORDER_NEW: { priority: 'high', icon: '✨', label: 'New customer order', zone: 'office', visual: 'ticket' },
  ORDER_PRODUCTION: { priority: 'high', icon: '🪡', label: 'Production started', zone: 'sewing', visual: 'line-start' },
  ORDER_COMPLETED: { priority: 'high', icon: '🌍', label: 'Order completed', zone: 'shipping', visual: 'truck-depart' },
  ORDER_LATE: { priority: 'high', icon: '⏰', label: 'Order slipping', zone: 'office', visual: 'pulse' },
  PO_RAISED: { priority: 'medium', icon: '📋', label: 'Purchase order raised', zone: 'office', visual: 'ticket' },
  PO_APPROVED: { priority: 'high', icon: '📤', label: 'PO approved and sent to supplier', zone: 'office', visual: 'envelope' },
  PO_REJECTED: { priority: 'medium', icon: '✕', label: 'Purchase order rejected', zone: 'office', visual: 'pulse' },
  MATERIAL_RECEIVED: { priority: 'medium', icon: '🚚', label: 'Material received against a PO', zone: 'receiving', visual: 'supplier-truck' },
  GRN_CREATED: { priority: 'medium', icon: '📦', label: 'Goods received (GRN)', zone: 'receiving', visual: 'supplier-truck' },
  FABRIC_QC_PASSED: { priority: 'medium', icon: '✓', label: 'Fabric passed inspection', zone: 'receiving', visual: 'rolls-to-store' },
  FABRIC_QC_FAILED: { priority: 'high', icon: '🔴', label: 'Fabric failed inspection', zone: 'receiving', visual: 'beacon' },
  MATERIAL_ISSUED: { priority: 'medium', icon: '🧵', label: 'Fabric issued to cutting', zone: 'store', visual: 'roll-trolley' },
  TRIMS_ISSUED: { priority: 'medium', icon: '🏷️', label: 'Trims issued to sewing', zone: 'trims', visual: 'trims-cart' },
  CUTTING_PROGRESS: { priority: 'low', icon: '✂️', label: 'Pieces cut', zone: 'cutting', visual: 'cut' },
  BUNDLES_CREATED: { priority: 'medium', icon: '📦', label: 'Bundles created', zone: 'staging', visual: 'bundles' },
  BUNDLES_ISSUED: { priority: 'medium', icon: '📦', label: 'Bundles sent to sewing', zone: 'sewing', visual: 'bundle-trolley' },
  SEWING_OUTPUT: { priority: 'low', icon: '👕', label: 'Garments sewn', zone: 'sewing', visual: 'garments-to-qc' },
  PRODUCTION_COMPLETED: { priority: 'high', icon: '✅', label: 'Production completed', zone: 'sewing', visual: 'garments-to-qc' },
  LINE_DELAY: { priority: 'high', icon: '⏰', label: 'Production delay', zone: 'sewing', visual: 'beacon' },
  QC_INSPECTED: { priority: 'low', icon: '🔍', label: 'Garments inspected', zone: 'qc', visual: null },
  QC_HIGH_REJECTION: { priority: 'high', icon: '⚠️', label: 'High rejection', zone: 'qc', visual: 'beacon' },
  TO_FINISHING: { priority: 'medium', icon: '🔥', label: 'Garments sent to finishing', zone: 'finishing', visual: 'garment-cart' },
  TO_PROCESS: { priority: 'medium', icon: '🚐', label: 'Garments sent for processing', zone: 'finishing', visual: 'van' },
  PACKING_STARTED: { priority: 'medium', icon: '📦', label: 'Packing started', zone: 'packing', visual: 'pulse' },
  PACKING_COMPLETED: { priority: 'medium', icon: '📦', label: 'Cartons packed', zone: 'packing', visual: 'cartons-to-fg' },
  DISPATCH_LOADING: { priority: 'high', icon: '🚚', label: 'Dispatch loading', zone: 'shipping', visual: 'truck-dock' },
  DISPATCH_DEPARTED: { priority: 'high', icon: '🌍', label: 'Truck left the factory', zone: 'shipping', visual: 'truck-depart' },
  MATERIAL_SHORTAGE: { priority: 'high', icon: '🔴', label: 'Material shortage', zone: 'store', visual: 'beacon' },
};

/** The order a day's story is told in: the physical flow of a garment order. */
export const STORY_ORDER = [
  'ORDER_NEW', 'PO_RAISED', 'PO_APPROVED', 'PO_REJECTED', 'MATERIAL_RECEIVED', 'GRN_CREATED', 'FABRIC_QC_PASSED',
  'FABRIC_QC_FAILED', 'MATERIAL_SHORTAGE', 'MATERIAL_ISSUED', 'TRIMS_ISSUED', 'CUTTING_PROGRESS', 'BUNDLES_CREATED',
  'BUNDLES_ISSUED', 'ORDER_PRODUCTION', 'SEWING_OUTPUT', 'LINE_DELAY', 'PRODUCTION_COMPLETED', 'QC_INSPECTED', 'QC_HIGH_REJECTION',
  'TO_FINISHING', 'TO_PROCESS', 'PACKING_STARTED', 'PACKING_COMPLETED', 'DISPATCH_LOADING', 'DISPATCH_DEPARTED',
  'ORDER_COMPLETED', 'ORDER_LATE',
];

/**
 * A visual event. `key` makes the id stable, so the same transaction seen twice (diff and replay)
 * is recognised; `ref` points the inspector at the document; `at` is when it happened if known;
 * `demo` marks an event read from a module that still runs on sample data.
 */
export const makeEvent = (kind, { key, title, detail = '', ref = null, qty = null, colour = null, destination = null, lineId = null, at = null, demo = false }) => {
  const meta = EVENT_KINDS[kind];
  return {
    id: `${kind}:${key}`,
    kind,
    priority: meta.priority,
    icon: meta.icon,
    label: meta.label,
    zone: meta.zone,
    visual: meta.visual,
    title,
    detail,
    ref,
    qty,
    colour,
    destination,
    lineId,
    at,
    demo,
  };
};
