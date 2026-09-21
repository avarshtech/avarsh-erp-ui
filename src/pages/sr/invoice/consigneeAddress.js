/**
 * Consignee address helpers, shared by the invoice header and the SR prefill.
 *
 * An invoice stores its consignee as a snapshot — a name and a block of address
 * text, not a buyer id — so a buyer later renamed or re-addressed never rewrites
 * an invoice already raised. These turn a buyer's shipping location into that
 * snapshot in ONE place, so the address the SR prefill writes and the address
 * the dropdown writes are character-identical. That is what lets the header show
 * which location is currently in force without storing its id: it compares.
 */

/** A buyer's shipping locations that are still in use, in master order. */
export const activeLocations = (buyer) => (buyer?.shippingLocations || [])
  .filter((l) => l.active !== false);

/** One shipping location as the address block that prints on the invoice. */
export const formatLocationAddress = (loc) => (loc
  ? [
    loc.address,
    [loc.city, loc.state].filter(Boolean).join(', '),
    [loc.postalCode, loc.country].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n')
  : '');

/**
 * The address to render for a buyer nobody has chosen a location for yet. A
 * lone shipping location is unambiguous, so it is used; several are not, and
 * those wait for the user to pick one rather than guessing at the first.
 */
export const soleLocationAddress = (buyer) => {
  const locations = activeLocations(buyer);
  return locations.length === 1 ? formatLocationAddress(locations[0]) : '';
};

/** The buyer a consignee name refers to, or null when it matches no master. */
export const findBuyerByName = (buyers, name) => (name
  ? (buyers || []).find((b) => b.name === name) || null
  : null);
