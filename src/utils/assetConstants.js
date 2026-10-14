/**
 * Mirrors the server's AssetStatus, AssetCondition and MovementEventType.
 * Change one and change the other, or a saved asset shows a blank status.
 */

export const ASSET_STATUS = {
  ACTIVE: { label: 'Active', color: 'green' },
  AVAILABLE: { label: 'Available', color: 'cyan' },
  UNDER_MAINTENANCE: { label: 'Under maintenance', color: 'orange' },
  UNDER_REPAIR: { label: 'Under repair', color: 'orange' },
  IDLE: { label: 'Idle', color: 'default' },
  DAMAGED: { label: 'Damaged', color: 'red' },
  IN_TRANSIT: { label: 'In transit', color: 'blue' },
  DISPOSED: { label: 'Disposed', color: 'default' },
};

/**
 * The statuses the asset form offers. IN_TRANSIT and DISPOSED belong to the
 * transfer and disposal workflows, and the server refuses them on an edit, so
 * offering them here would only produce an error the user cannot act on.
 */
export const EDITABLE_STATUSES = [
  'ACTIVE', 'AVAILABLE', 'UNDER_MAINTENANCE', 'UNDER_REPAIR', 'IDLE', 'DAMAGED',
];

export const ASSET_CONDITION = {
  NEW: { label: 'New', color: 'green' },
  GOOD: { label: 'Good', color: 'green' },
  FAIR: { label: 'Fair', color: 'orange' },
  DAMAGED: { label: 'Damaged', color: 'red' },
  BEYOND_REPAIR: { label: 'Beyond repair', color: 'red' },
};

export const MOVEMENT_EVENT = {
  CREATED: { label: 'Added to register', color: 'blue' },
  TRANSFER: { label: 'Transferred', color: 'orange' },
  DISPOSED: { label: 'Disposed', color: 'default' },
};

/**
 * Why an asset is in the state it is in. Mirrors AssetStatusReason; the server
 * also serves the list at /assets/status-reasons, which is what the dialog
 * reads, so this map exists only to label a code the register has already got.
 */
export const STATUS_REASON = {
  NO_ORDERS: 'No orders',
  NO_OPERATOR: 'No operator available',
  NOT_REQUIRED: 'Not required',
  SEASONAL: 'Seasonal',
  AWAITING_PARTS: 'Awaiting parts',
  BREAKDOWN: 'Breakdown',
  ACCIDENT: 'Accident damage',
  WEAR_AND_TEAR: 'Wear and tear',
  ROUTINE_SERVICE: 'Routine service',
  VENDOR_SERVICE: 'With vendor',
  OTHER: 'Other',
};

/** The states the server insists on a reason for. Mirrors AssetStatusReason.REQUIRES_REASON. */
export const NEEDS_REASON = ['IDLE', 'DAMAGED', 'UNDER_REPAIR', 'UNDER_MAINTENANCE'];

export const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown' },
];

/** Enum maps to the {value,label} lists the Select components want. */
export const toOptions = (map, keys) =>
  (keys ?? Object.keys(map)).map((value) => ({ value, label: map[value]?.label ?? value }));

export const statusMeta = (status) => ASSET_STATUS[status] ?? { label: status ?? '-', color: 'default' };
export const conditionMeta = (condition) =>
  ASSET_CONDITION[condition] ?? { label: condition ?? '-', color: 'default' };
export const eventMeta = (event) => MOVEMENT_EVENT[event] ?? { label: event ?? '-', color: 'default' };

/** "-" rather than an empty cell, so a missing value reads as missing. */
export const dash = (value) => (value === null || value === undefined || value === '' ? '-' : value);
