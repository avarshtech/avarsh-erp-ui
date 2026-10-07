/**
 * The one principal order both Job Work demos share (decision 21): stitching-onwards work we do for
 * Kochi Kids Apparel, whose Pink panels our process vendor Bright Prints prints. The Outward demo
 * tracks the printing job; the Inward demo holds the panels as the principal's stock. Both seeds read
 * this, so the two stores agree on quantities.
 */
export const SHARED_ORDER = {
  outwardOrderId: 6,
  outwardJobId: 12,
  orderN: 1025,
  printingDocN: 1005,
  principal: 'Kochi Kids Apparel',
  styleNo: 'KK-FRK-08',
  styleName: 'Printed frock',
  sizes: ['2Y', '4Y', '6Y', '8Y'],
  colours: [
    { colour: 'Pink', qty: { '2Y': 300, '4Y': 400, '6Y': 400, '8Y': 300 } },
    { colour: 'Lilac', qty: { '2Y': 250, '4Y': 350, '6Y': 350, '8Y': 250 } },
  ],
  dueInWorkingDays: 10,
  /** Usable Pink panel sets sent for printing, and printed sets back so far (two trips), per size. */
  printSent: { '2Y': 302, '4Y': 402, '6Y': 402, '8Y': 302 },
  printBackTrips: [
    { '2Y': 128, '4Y': 172, '6Y': 172, '8Y': 128 },
    { '2Y': 86, '4Y': 114, '6Y': 114, '8Y': 86 },
  ],
};

/** Printed sets back so far, per size. */
export const printBackBySize = () => SHARED_ORDER.printBackTrips.reduce((acc, trip) => {
  Object.entries(trip).forEach(([size, q]) => { acc[size] = (acc[size] || 0) + q; });
  return acc;
}, {});
