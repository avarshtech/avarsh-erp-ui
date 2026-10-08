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
 * Both parties are snapshotted onto the shipment as { name, block } when it is
 * saved: the mock layer is synchronous and cannot reach the buyer API, and an
 * invoice raised against the shipment copies the blocks verbatim.
 */
import {
  activeLocations, formatLocationAddress,
} from '../../sample-request/invoice/consigneeAddress';

export const NOTIFY_BANK = 'BANK';
const LOC_PREFIX = 'LOC:';

/**
 * The "Attn:" line. `GET /buyers` masks the phone for non-admin roles
 * (BuyerService.maskSensitiveFields), and a masked number must never be snapshotted
 * onto a document — so a phone carrying the mask is left off.
 */
const contactLine = (buyer) => [
  buyer?.contactPerson,
  buyer?.phone && !String(buyer.phone).includes('*') ? buyer.phone : null,
].filter(Boolean).join(' · ');

const locationValue = (loc) => `${LOC_PREFIX}${loc.id}`;
const locationLabel = (loc) => [loc.label, [loc.city, loc.country].filter(Boolean).join(', ')]
  .filter(Boolean)
  .join(' — ');
const locationById = (buyer, id) => (id == null
  ? null
  : activeLocations(buyer).find((l) => Number(l.id) === Number(id)) || null);

/** The stored notify party → the Select value. */
export const notifyValueOf = (party) => {
  if (party?.kind === 'BANK') return NOTIFY_BANK;
  if (party?.kind === 'LOCATION' && party.locationId != null) return `${LOC_PREFIX}${party.locationId}`;
  return undefined;
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

/** The consignee as it prints: buyer name, the shipping address, then the Attn line. */
export const consigneeOf = (buyer, location) => {
  if (!buyer) return null;
  const contact = contactLine(buyer);
  return {
    name: buyer.name,
    locationId: location?.id ?? null,
    block: [buyer.name, formatLocationAddress(location), contact ? `Attn: ${contact}` : null]
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
