/**
 * What of the principal's material is still to be accounted for, lot by lot — the job worker's side of
 * their ITC-04. Returned, written-off or moved quantities settle their own lot. Material that went into
 * returned garments (pieces × the agreed consumption) and disposed waste settle the oldest challan
 * first, but only up to what each lot actually sent into production. Pure.
 */
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * `lots` = [{ id, date, received, returned, writtenOff, movedOut, consumable }] for ONE material,
 * `accounted` = quantity accounted for by returned garments and disposed waste.
 * Returns { byLot: { [lotId]: { outstanding, settledByUse } }, unallocated }.
 */
export const knockOff = (lots, accounted) => {
  let left = Math.max(0, Number(accounted) || 0);
  const out = {};
  [...lots].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach((lot) => {
    const take = Math.min(left, Math.max(0, lot.consumable));
    left = round3(left - take);
    out[lot.id] = {
      settledByUse: round3(take),
      outstanding: round3(Math.max(0, lot.received - lot.returned - lot.writtenOff - lot.movedOut - take)),
    };
  });
  return { byLot: out, unallocated: left };
};

/** Pieces of a material accounted for by returned pieces: good + rejected × the agreed consumption. */
export const accountedByPieces = ({ consumption, pieces }) => round3((Number(consumption) || 0) * (Number(pieces) || 0));

/**
 * Which of the principal's challans a return settles, by comparing outstanding before and after.
 * `before` / `after` = knockOff(...).byLot; `challanOf` = { lotId: 'their DC no' }.
 */
export const settledChallans = (before, after, challanOf) => {
  const dcs = new Set();
  Object.keys(after).forEach((lotId) => {
    if ((before[lotId]?.outstanding || 0) - (after[lotId]?.outstanding || 0) > 1e-9) dcs.add(challanOf[lotId]);
  });
  return [...dcs].filter(Boolean);
};
