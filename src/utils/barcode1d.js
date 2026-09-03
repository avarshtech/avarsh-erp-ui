/**
 * EAN-13 and Code 128-B rendered as inline SVG.
 *
 * Hand-rolled rather than pulled from a dependency: these two symbologies are the
 * only ones the analysed buyer formats need (PRD §19 — Vingino's EAN, plus an
 * internal carton identifier), and the encoders are small and stable. QR is a
 * different matter — a correct encoder needs Reed–Solomon and mask evaluation, so
 * it stays off until the API phase.
 *
 * SVG rather than canvas because these are printed: vectors stay crisp at any DPI,
 * and the thermal-label guidance is ≥203 dpi.
 */

// ─── EAN-13 ─────────────────────────────────────────────────────────────────────

const L_CODE = ['0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_CODE = ['0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_CODE = ['1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'];

// Which of the left-hand six digits use L vs G encoding, chosen by the first digit.
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** EAN-13 check digit: positions alternate weight 1 and 3, from the left. */
export const ean13CheckDigit = (digits12) => {
  const d = String(digits12).replace(/\D/g, '').slice(0, 12);
  if (d.length !== 12) return null;
  const sum = d.split('').reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
};

/**
 * Normalise to 13 digits: accepts 12 (check digit appended) or 13 (verified).
 * Returns null for anything else, so a caller can report a bad EAN rather than
 * printing a barcode that will not scan.
 */
export const normaliseEan13 = (value) => {
  const d = String(value ?? '').replace(/\D/g, '');
  if (d.length === 12) return d + ean13CheckDigit(d);
  if (d.length === 13) return ean13CheckDigit(d.slice(0, 12)) === Number(d[12]) ? d : null;
  return null;
};

/** Module pattern for a full EAN-13: 95 modules including guards. */
export const ean13Modules = (value) => {
  const code = normaliseEan13(value);
  if (!code) return null;
  const first = Number(code[0]);
  const parity = PARITY[first];
  let bits = '101'; // start guard
  for (let i = 1; i <= 6; i += 1) {
    const digit = Number(code[i]);
    bits += parity[i - 1] === 'L' ? L_CODE[digit] : G_CODE[digit];
  }
  bits += '01010'; // centre guard
  for (let i = 7; i <= 12; i += 1) bits += R_CODE[Number(code[i])];
  bits += '101'; // end guard
  return { code, bits };
};

// ─── Code 128-B ─────────────────────────────────────────────────────────────────

// Each symbol is six alternating bar/space widths summing to 11 modules; the stop
// symbol has seven and sums to 13. Index is the Code 128 value.
const C128_WIDTHS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/**
 * Module pattern for Code 128-B. Set B covers ASCII 32–126, which is every
 * character a carton identifier uses.
 */
export const code128Modules = (value) => {
  const text = String(value ?? '');
  if (!text) return null;
  const values = [];
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    // Outside set B there is nothing sensible to encode; refuse rather than
    // silently emitting a barcode that decodes to something else.
    if (v < 0 || v > 94) return null;
    values.push(v);
  }
  // Checksum: start value plus each symbol weighted by its 1-based position.
  const checksum = values.reduce((acc, v, i) => acc + v * (i + 1), START_B) % 103;
  const symbols = [START_B, ...values, checksum, STOP];

  let bits = '';
  symbols.forEach((sym) => {
    const widths = C128_WIDTHS[sym];
    // Widths alternate bar, space, bar, space… starting with a bar.
    widths.split('').forEach((w, i) => {
      bits += (i % 2 === 0 ? '1' : '0').repeat(Number(w));
    });
  });
  return { code: text, bits };
};

// ─── SVG ────────────────────────────────────────────────────────────────────────

const runsToRects = (bits, moduleWidth, height) => {
  let out = '';
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '0') { i += 1; continue; }
    let run = 0;
    while (i + run < bits.length && bits[i + run] === '1') run += 1;
    out += `<rect x="${(i * moduleWidth).toFixed(3)}" y="0" width="${(run * moduleWidth).toFixed(3)}" height="${height}" fill="#000"/>`;
    i += run;
  }
  return out;
};

/**
 * Render a barcode as an inline SVG string.
 *
 * `heightMm` is the bar height; the quiet zone either side is the symbology
 * minimum (10 modules for EAN-13, 10 for Code 128) so scanners have somewhere to
 * start. Returns null when the value cannot be encoded, which the caller should
 * surface rather than print a blank space.
 */
export const barcodeSvg = (type, value, { heightMm = 12, moduleMm = 0.33, showText = true } = {}) => {
  const encoded = type === 'EAN13' ? ean13Modules(value) : code128Modules(value);
  if (!encoded) return null;

  const quiet = 10;
  const totalModules = encoded.bits.length + quiet * 2;
  const widthMm = totalModules * moduleMm;
  const textMm = showText ? 3.2 : 0;
  const barsMm = heightMm - textMm;

  const bars = runsToRects(encoded.bits, moduleMm, barsMm);
  const label = showText
    ? `<text x="${(widthMm / 2).toFixed(2)}" y="${(heightMm - 0.4).toFixed(2)}" font-family="monospace" font-size="2.6" text-anchor="middle" fill="#000">${encoded.code}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(2)}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm.toFixed(2)} ${heightMm}" shape-rendering="crispEdges">`
    + `<g transform="translate(${(quiet * moduleMm).toFixed(3)},0)">${bars}</g>${label}</svg>`;
};

export const SUPPORTED_SYMBOLOGIES = ['EAN13', 'CODE128'];
