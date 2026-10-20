import { hasPermission } from '../../utils/permissions';

/**
 * Everything the costing sheet can create without leaving the page, with the permission each
 * needs. The keys are module-level, so a grant here lets the user create that master anywhere.
 */
export const QUICK_CREATE_TYPES = {
  item: { title: 'New material', permission: ['items', 'add'], label: 'Items', size: 640 },
  buyer: { title: 'New buyer', permission: ['buyer-info', 'add'], label: 'Buyer', size: 480 },
  style: { title: 'New style', permission: ['style-master', 'add'], label: 'Style Master', size: 520 },
  supplier: { title: 'New supplier', permission: ['supplier-info', 'add'], label: 'Supplier', size: 480 },
  vendor: { title: 'New vendor', permission: ['vendor-info', 'add'], label: 'Vendor', size: 520 },
  sizePreset: { title: 'New size preset', permission: ['size-presets', 'add'], label: 'Size Presets', size: 480 },
  process: { title: 'New process', permission: ['process-master', 'add'], label: 'Process Master', size: 420 },
  overhead: { title: 'New overhead', permission: ['overhead-master', 'add'], label: 'Overhead Master', size: 420 },
};

export const canQuickCreate = (type) => {
  const permission = QUICK_CREATE_TYPES[type]?.permission;
  return !!permission && hasPermission(permission[0], permission[1]);
};

/** Why the create option is disabled — names the exact right to ask an admin for. */
export const quickCreateHint = (type) =>
  `You need "${QUICK_CREATE_TYPES[type]?.label} → Add" permission to create this. Ask an admin.`;

/** New sub-categories and item types (from the material form) need master-data:add as well. */
export const canCreateClassifiers = () => hasPermission('master-data', 'add');
