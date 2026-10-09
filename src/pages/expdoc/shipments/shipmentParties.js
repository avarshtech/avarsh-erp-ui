/**
 * The two parties a shipment prints, derived from the real buyer master.
 *
 * The consignee IS the buyer. The notify party is mandatory and is either the
 * buyer's bank or one of its shipping locations. The consignee's address comes from
 * a shipping location, never by position — the API returns locations unordered and
 * Buyer Master cannot reorder them:
 *   - notify = a shipping location → that location's address;
 *   - notify = the bank → the location picked as "Consignee address", or the
 *     buyer's only location when there is just one.
 *
 * The server builds both printed blocks from the buyer master when the shipment is
 * saved (ShipmentPartyBuilder), to the same text as the preview built here; the form
 * sends only ids. An invoice raised against the shipment copies the blocks verbatim.
 *
 * Buyer Master renews every shipping location's id each time the buyer is saved, so a
 * saved choice is matched again by its label (rematchLocationId).
 */
import {
  activeLocations, formatLocationAddress,
} from '../../sample-request/invoice/consigneeAddress.js';

export const NOTIFY_BANK = 'BANK';
const LOC_PREFIX = 'LOC:';

const locationValue = (loc) => `${LOC_PREFIX}${loc.id}`;
const locationLabel = (loc) => [loc.label, [loc.city, loc.country].filter(Boolean).join(', ')]
  .filter(Boolean)
  .join(' — ');
const locationById = (buyer, id) => (id == null
  ? null
  : activeLocations(buyer).find((l) => Number(l.id) === Number(id)) || null);

/**
 * A saved location id while the buyer still has it, else the active location with the
 * saved label (Buyer Master renewed the ids), else null: pick it again.
 */
export const rematchLocationId = (buyer, id, label) => {
  if (locationById(buyer, id)) return Number(id);
  const byLabel = label ? activeLocations(buyer).find((l) => l.label === label) : null;
  return byLabel ? byLabel.id : null;
};

/** The stored notify party → the Select value, matched against the buyer when it is known. */
export const notifyValueOf = (party, buyer) => {
  if (party?.kind === 'BANK') return NOTIFY_BANK;
  if (party?.kind !== 'LOCATION') return undefined;
  const id = buyer ? rematchLocationId(buyer, party.locationId, party.locationLabel) : party.locationId;
  return id != null ? `${LOC_PREFIX}${id}` : undefined;
};

/** The Select value → the stored notify party. */
export const notifyPartyOf = (value) => {
  if (value === NOTIFY_BANK) return { kind: 'BANK', locationId: null };
  if (typeof value === 'string' && value.startsWith(LOC_PREFIX)) {
    return { kind: 'LOCATION', locationId: Number(value.slice(LOC_PREFIX.length)) };
  }
  return null;
};

/** Every value the notify party may take for this buyer: the bank first, then the locations. */
const notifyValuesOf = (buyer) => [
  ...(buyer?.bankName ? [NOTIFY_BANK] : []),
  ...activeLocations(buyer).map(locationValue),
];

export const isNotifyValueValid = (buyer, value) => notifyValuesOf(buyer).includes(value);

/** With exactly one choice there is nothing to ask — the form fills it in. */
export const soleNotifyValue = (buyer) => {
  const values = notifyValuesOf(buyer);
  return values.length === 1 ? values[0] : undefined;
};

/** Notify-party options, grouped once a bank sits beside the locations. */
export const notifyOptionsOf = (buyer) => {
  const locations = activeLocations(buyer).map((loc) => ({ value: locationValue(loc), label: locationLabel(loc) }));
  if (!buyer?.bankName) return locations;
  const bank = {
    value: NOTIFY_BANK,
    label: [buyer.bankName, buyer.swiftCode ? `SWIFT ${buyer.swiftCode}` : null].filter(Boolean).join(' · '),
  };
  return [
    { label: 'Bank', title: 'Bank', options: [bank] },
    ...(locations.length ? [{ label: 'Shipping locations', title: 'Shipping locations', options: locations }] : []),
  ];
};

/** A second dropdown is needed only when the bank is notified and the address is ambiguous. */
export const needsConsigneeAddress = (buyer, notifyValue) =>
  notifyValue === NOTIFY_BANK && activeLocations(buyer).length > 1;

export const consigneeAddressOptions = (buyer) =>
  activeLocations(buyer).map((loc) => ({ value: loc.id, label: locationLabel(loc) }));

/** The shipping location whose address the consignee prints, or null while none is known. */
export const consigneeLocationOf = (buyer, notifyValue, consigneeLocationId) => {
  const party = notifyPartyOf(notifyValue);
  if (party?.kind === 'LOCATION') return locationById(buyer, party.locationId);
  if (party?.kind !== 'BANK') return null;
  const locations = activeLocations(buyer);
  return locations.length === 1 ? locations[0] : locationById(buyer, consigneeLocationId);
};

/** The consignee as it prints: buyer name, the shipping address, then "Attn:" and the contact person — never the phone. */
export const consigneeOf = (buyer, location) => {
  if (!buyer) return null;
  return {
    name: buyer.name,
    block: [buyer.name, formatLocationAddress(location), buyer.contactPerson ? `Attn: ${buyer.contactPerson}` : null]
      .filter(Boolean)
      .join('\n'),
  };
};

/** The notify party as it prints: the bank with its SWIFT, or the location with its address. */
export const notifyOf = (buyer, notifyValue) => {
  const party = notifyPartyOf(notifyValue);
  if (!buyer || !party) return null;
  if (party.kind === 'BANK') {
    if (!buyer.bankName) return null;
    return {
      name: buyer.bankName,
      block: [buyer.bankName, buyer.swiftCode ? `SWIFT: ${buyer.swiftCode}` : null].filter(Boolean).join('\n'),
    };
  }
  const loc = locationById(buyer, party.locationId);
  return loc
    ? { name: loc.label, block: [loc.label, formatLocationAddress(loc)].filter(Boolean).join('\n') }
    : null;
};
