/**
 * The carton-sticker editor's model: what a new face or line starts as, the keys they get,
 * and how a line changes when its kind or data source changes. The layout shape is
 * `stickerLayout` (§3 of the sticker plan): faces of lines, each line a FIELD, a SIZE_GRID
 * or a BARCODE. The per-run questions' keys (`askKeyFor`) live in expDocTemplateSchema.
 * No React or antd here, so the unit project can load it.
 */
import { BARCODE_SYMBOLOGY, FACE_RENDER, STICKER_LINE_KIND } from '../../../../../utils/expDocConstants';
import { STICKER_READER_CATEGORIES, getFieldMeta } from '../../../../../utils/expDocTemplateSchema';
import { newRowKey } from '../rowKeys';

/** What a sticker line may print — the list the AI reader is sent, so the two cannot drift. */
export const STICKER_FIELD_CATEGORIES = STICKER_READER_CATEGORIES;

export const SIZE_GRID_BINDING = 'carton.sizeQty';
export const EAN_BINDING = 'carton.eanBySize';
export const CARTON_NO_BINDING = 'carton.cartonNo';
const CARTON_NO_PATTERN = '{n} OF {N}';

export const RENDER_OPTIONS = [
  { value: FACE_RENDER.LINES, label: 'Lines — LABEL: value' },
  { value: FACE_RENDER.COLON_LIST, label: 'Colon list — colons aligned' },
  { value: FACE_RENDER.TABLE, label: 'Table — bordered label | value' },
  { value: FACE_RENDER.STACK, label: 'Stack — small label, large value' },
  { value: FACE_RENDER.TEXT_BLOCK, label: 'Text block — monospaced lines' },
];

export const KIND_OPTIONS = [
  { value: STICKER_LINE_KIND.FIELD, label: 'Field' },
  { value: STICKER_LINE_KIND.SIZE_GRID, label: 'Size grid' },
  { value: STICKER_LINE_KIND.BARCODE, label: 'Barcode' },
];

export const BARCODE_SOURCES = [
  { value: EAN_BINDING, label: 'EAN of each size' },
  { value: CARTON_NO_BINDING, label: 'Carton number' },
  { value: 'fixed:', label: 'Fixed text' },
];

export const SYMBOLOGY_OPTIONS = Object.entries(BARCODE_SYMBOLOGY).map(([value, s]) => ({
  value, label: s.printable ? s.label : `${s.label} (not printed yet)`,
}));

const FACE_PLACES = ['MAIN', 'SIDE'];
const FACE_TITLES = { MAIN: 'MAIN MARK', SIDE: 'SIDE MARK' };

/** MAIN, then SIDE, then FACE3, FACE4 … — the first key the layout does not use yet. */
export const nextFaceKey = (faces) => {
  const used = new Set((faces || []).map((f) => f?.key));
  const keyAt = (n) => FACE_PLACES[n] || `FACE${n + 1}`;
  let n = 0;
  while (used.has(keyAt(n))) n += 1;
  return keyAt(n);
};

/** An empty face: plain "LABEL: value" lines inside a border, without the exporter's logo. */
export const newFace = (key) => ({
  key, title: FACE_TITLES[key] || key, render: FACE_RENDER.LINES, border: true, caption: null, symbol: null, logo: false, lines: [],
});

const KIND_DEFAULTS = {
  [STICKER_LINE_KIND.FIELD]: () => ({ binding: null }),
  [STICKER_LINE_KIND.SIZE_GRID]: () => ({ binding: SIZE_GRID_BINDING, grid: { cells: 'QTY', sizes: 'ALL', totals: true } }),
  [STICKER_LINE_KIND.BARCODE]: () => ({
    binding: EAN_BINDING, barcode: { symbology: 'EAN13', perSize: true, showText: true, heightMm: 12 },
  }),
};

/** A new line of a kind, with that kind's defaults and a key no other line has. */
export const newLine = (kind = STICKER_LINE_KIND.FIELD) => ({
  key: newRowKey('line'), kind, label: null, ...(KIND_DEFAULTS[kind] || KIND_DEFAULTS.FIELD)(),
});

const KEPT_ON_KIND_CHANGE = ['key', 'label', 'fontPt', 'bold', 'caps', 'align'];

/** The line as another kind: its key, label and font stay; the old kind's data and settings go. */
export const switchKind = (line, kind) => KEPT_ON_KIND_CHANGE.reduce(
  (out, k) => (line[k] === undefined ? out : { ...out, [k]: line[k] }),
  newLine(kind),
);

/** The tokens a pattern can fill for a binding — the carton number's or the measurement's. */
const PATTERN_TOKENS = { 'carton.cartonNo': 'n', 'carton.nOfN': 'n', 'carton.dimensions': 'LBH' };
const PATTERN_HINTS = {
  n: '{n} is this carton, {N} the cartons in the shipment — e.g. {n} OF {N}',
  LBH: '{L}, {B} and {H} are the carton\'s length, breadth and height in cm — e.g. {L}x{B}x{H}CMS',
};

/**
 * A field line pointed at another binding. A pattern stays only while the new binding fills
 * the same tokens (it would otherwise print "{n}" literally); a carton number without one
 * starts as "{n} OF {N}", never a bare number.
 */
export const fieldBindingChanges = (line, binding) => {
  const tokens = PATTERN_TOKENS[binding];
  if (line.pattern && tokens && tokens === PATTERN_TOKENS[line.binding]) return { binding };
  return { binding, pattern: binding === CARTON_NO_BINDING ? CARTON_NO_PATTERN : undefined };
};

/** Which formatting a field's binding can use: decimals for a number, a join for a list, a pattern for the carton number and measurement. */
export const fieldTraits = (binding) => {
  const type = getFieldMeta(binding)?.type;
  const pattern = PATTERN_HINTS[PATTERN_TOKENS[binding]] || null;
  return { decimals: type === 'number' && !pattern, join: type === 'list' || type === 'map', pattern };
};

/**
 * A barcode line's new source. Only the EAN of each size prints one barcode per size, and a
 * carton number cannot be an EAN, so it starts as Code 128.
 */
export const barcodeSourceChanges = (line, binding) => {
  const current = line.barcode || {};
  const perSize = binding === EAN_BINDING;
  let { symbology } = current;
  if (binding === CARTON_NO_BINDING) symbology = 'CODE128';
  else if (perSize && !['EAN13', 'UPCA'].includes(symbology)) symbology = 'EAN13';
  return { binding, barcode: { ...current, symbology, perSize } };
};

/** The catalogue fields the layout's field lines print, in print order: what "Required before printing" offers. */
export const printedFieldBindings = (faces) => [...new Set((faces || [])
  .flatMap((face) => face?.lines || [])
  .filter((line) => line && (line.kind || STICKER_LINE_KIND.FIELD) === STICKER_LINE_KIND.FIELD && getFieldMeta(line.binding))
  .map((line) => line.binding))];
