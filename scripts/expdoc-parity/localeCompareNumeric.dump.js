// Parity fixtures for localeCompare with { numeric: true } -> erp-purchase JsCollation.localeCompareNumeric
// (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The invoice's size-range label (expDocInvoiceCalc sizeRangeLabel) orders sizes the style's preset does not
// rank by a.localeCompare(b, undefined, { numeric: true }): ICU's root collation, with a run of decimal digits
// weighed as the number it spells. These families pin the server's port to V8 on the sizes garment buyers use
// (alpha, kids' heights, baby month ranges, waist/length, EU/UK/US), on leading zeros, on very long numbers
// (ICU weighs 254 digits at a time), on other scripts' digits, and on what ends a digit run.
//
// One case per family, every string against every other, as localeCompare.dump.js writes them.
import { test, expect } from 'vitest';
import { writeFixtures } from './writeFixtures.js';

const localeCompareNumericRows = function localeCompareNumericRows(strings) {
  const compare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
  return strings.map((a) => strings.map((b) => '<=>'[Math.sign(compare(a, b)) + 1]).join(''));
};

const ch = (...codes) => String.fromCharCode(...codes);
const NBSP = ch(0xa0);
const ZWSP = ch(0x200b);
const SOFT_HYPHEN = ch(0xad);
const ACUTE = ch(0x301);
const EN_DASH = ch(0x2013);
const E_ACUTE = ch(0xe9);
const ARABIC = (s) => [...s].map((d) => ch(0x660 + Number(d))).join('');
const DEVANAGARI = (s) => [...s].map((d) => ch(0x966 + Number(d))).join('');
const FULL_WIDTH = (s) => [...s].map((d) => ch(0xff10 + Number(d))).join('');

const FAMILIES = {
  alphaSizes: [
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL', '10XL', '2XS', '3XS', 'xl', 'Xl', 'xL',
    'One Size', 'ONE SIZE', 'OS', 'S/M', 'M/L', 'L/XL', 'S-M', 'M-L', 'Free', 'free size', 'XL ', ' XL', 'XL-T', 'XLT',
  ],
  kidsAndBaby: [
    '50', '56', '62', '68', '74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '164', '176',
    '50/56', '62/68', '74/80', '86/92', '98/104', '110/116', '0-3M', '3-6M', '6-9M', '6-12M', '9-12M', '12-18M', '18-24M',
    '1-2Y', '2-3Y', '3-4Y', '10-11Y', '12-13Y', '2T', '3T', '4T', '5T', 'NB', 'Newborn',
  ],
  waistAndRegional: [
    '28', '29', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '28/30', '30/30', '30/32', '30W/32L', '32W/30L', '32W/32L',
    '30x32', '30 x 32', 'W30 L32', 'EU 38', 'EU 40', 'EU 9', 'EU38', 'UK 8', 'UK 10', 'UK8', 'US 2', 'US 10', 'US 0', 'US 00',
    '7/8', '9/10', '11/12', '13/14', '6', '6.5', '7', '7.5', '10', '10.5', '1/2', '3/4', '0', '00', '000',
  ],
  leadingZeros: [
    '0', '00', '000', '01', '001', '0001', '1', '010', '10', '0010', '100', '0100', '9', '09', '009',
    'a0', 'a00', 'a01', 'a1', 'a001b', 'a1b', 'a1a', 'a01a', 'A01', 'A1', 'x0y', 'x00y', 'x1y', '0a', '00a', '0A',
    '1a', '01a', '1A', '01A', `01${E_ACUTE}`, '1e', '1-01', '01-1', '1-1', '001.5', '1.5', '1.05', '1.50',
  ],
  numbersAndText: [
    '1', '2', '9', '10', '11', '19', '20', '99', '100', '101', '999', '1000', '2026', '73', '74', '75', '10233', '10234',
    '1234567', '12345678', '99999999', '100000000', '4294967295', '4294967296', '9007199254740993', '18446744073709551616',
    '1a', '1b', '1A', '1 ', ' 1', '-1', '-2', '+1', '1.', '.1', '1,5', '1 5', '1-5', '1_5', '1/5', '1.5', '1.10', '1.9',
    'a', 'A', 'b', '$', '$1', '$10', '$9', ch(0x20b9, 0x31, 0x30, 0x30), ch(0x20ac, 0x39), '#1', '#10', 'No. 9', 'No. 10',
    'PO-884213', 'PO-884214', 'PO-88421', 'PO-8842130', 'ST-2026-0441', 'ST-2026-441', 'ST-2026-04410', 'SG/26-27/999',
    'SG/26-27/1042', 'SG/26-27/1055', '2026-10-01', '2026-10-1', '2026-9-30', '2026-10-02', 'CPK/26-27/1001', 'CPK/26-27/101',
  ],
  longNumbers: [
    '9'.repeat(253), '9'.repeat(254), '9'.repeat(255), `1${'0'.repeat(253)}`, `1${'0'.repeat(254)}`, `1${'0'.repeat(255)}`,
    `1${'0'.repeat(254)}5`, `1${'0'.repeat(254)}05`, `1${'0'.repeat(254)}50`, `${'0'.repeat(300)}5`, '5', `${'0'.repeat(300)}`,
    `1${'0'.repeat(300)}`, `2${'0'.repeat(299)}`, `${'7'.repeat(254)}${'0'.repeat(254)}1`, `${'7'.repeat(254)}1`,
    `${'7'.repeat(254)}a`, `${'7'.repeat(254)}`, `x${'1'.repeat(260)}`, `x${'1'.repeat(259)}`,
  ],
  scriptsAndBreaks: [
    '1', '2', '10', '12', '13', '19', ARABIC('1'), ARABIC('12'), ARABIC('10'), DEVANAGARI('12'), DEVANAGARI('9'), FULL_WIDTH('1'),
    FULL_WIDTH('10'), FULL_WIDTH('012'), `${ARABIC('1')}2`, `1${DEVANAGARI('3')}`, ch(0xb2), ch(0xb9), ch(0x2070), ch(0xbd), ch(0x2153),
    ch(0x2460), `1${ch(0xb2)}`, `${ch(0xb2)}0`, `1${ZWSP}2`, `1${SOFT_HYPHEN}2`, `x${ZWSP}1`, 'x1', `1${ACUTE}2`, `1${ACUTE}`, `0${ACUTE}`,
    `1${NBSP}2`, '1 2', `1${EN_DASH}2`, '1-2', `l${ch(0xb7)}1`, `l${ch(0xb7)}01`, 'l1', '', ' ', 'a', '_1', '_01',
  ],
};

const CASES = Object.entries(FAMILIES).map(([family, strings]) => ({
  id: `localeCompareNumeric/${family}`, fn: localeCompareNumericRows, args: [strings],
}));

test('localeCompare numeric parity fixtures', () => {
  const { count } = writeFixtures('jsLocaleCompareNumeric', CASES);
  expect(count).toBe(CASES.length);
});
