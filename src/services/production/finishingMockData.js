/**
 * Finishing's own measurement chart, used by the checking sheet. Every other Finishing register is
 * on the API; the real chart lives in mst_measurement_specs and is not wired to Finishing yet.
 */

/** Buyer spec points per style and size. */
export const specPoints = (styleNo, size) => {
  const base = styleNo === 'HM-TS-2601'
    ? [['Chest round', 104, 1], ['Center back length', 72, 1], ['Sleeve length', 23.5, 0.5], ['Neck width', 18.5, 0.5], ['Bottom hem width', 100, 1]]
    : [['Waist', 82, 1], ['Inseam', 78, 1], ['Front rise', 26, 0.5], ['Thigh round', 58, 1]];
  const sizeShift = { S: -4, M: 0, L: 4, XL: 8, 30: -4, 32: 0, 34: 4, 36: 8 }[size] ?? 0;
  return base.map(([point, spec, tol]) => ({
    point,
    spec: spec + (point.includes('length') || point.includes('rise') ? sizeShift / 2 : sizeShift),
    tol,
    actual: null,
    remarks: '',
  }));
};

/** Every point on the buyer sheet, as an Excel import would bring them in. */
export const fullMeasurementChart = (styleNo, size) => {
  const extra = styleNo === 'HM-TS-2601'
    ? [['Shoulder width', 44, 0.5], ['Armhole straight', 24, 0.5], ['Sleeve opening', 17, 0.5], ['Neck drop front', 9.5, 0.3], ['Neck drop back', 2.5, 0.3]]
    : [['Back rise', 36, 0.5], ['Knee round', 44, 1], ['Leg opening', 36, 1], ['Belt loop length', 5.5, 0.3]];
  const sizeShift = { S: -2, M: 0, L: 2, XL: 4, 30: -2, 32: 0, 34: 2, 36: 4 }[size] ?? 0;
  return [
    ...specPoints(styleNo, size),
    ...extra.map(([point, spec, tol]) => ({ point, spec: spec + sizeShift / 2, tol, actual: null, remarks: '' })),
  ];
};
