// Parity fixtures for String.prototype.localeCompare -> erp-purchase JsCollation (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The rules sort by String(x ?? '').localeCompare(String(y ?? '')) (expDocPlNumbering orders packing dates
// so), which V8 answers with ICU's root collation. Java's own Collator orders spaces and punctuation
// differently, so the server carries its own port; these families pin it to V8 on the text export documents
// hold: style, PO and order numbers, colour and buyer names, dates; with case, accents (composed and
// decomposed), spaces, punctuation, digits, the empty string and null.
//
// One case per family: every string compared with every other, each row written as one character per pair
// ('<', '=' or '>'), so a family of 30 strings is 30 short lines.
import { test, expect } from 'vitest';
import { writeFixtures } from './writeFixtures.js';

const localeCompareRows = function localeCompareRows(strings) {
  return strings.map((a) => strings.map((b) => '<=>'[Math.sign(String(a ?? '').localeCompare(String(b ?? ''))) + 1]).join(''));
};

const ch = (...codes) => String.fromCharCode(...codes);
const NBSP = ch(0xa0);
const EN_SPACE = ch(0x2002);
const EN_DASH = ch(0x2013);
const EM_DASH = ch(0x2014);
const LEFT_QUOTE = ch(0x2018);
const RIGHT_QUOTE = ch(0x2019);
const LEFT_DQUOTE = ch(0x201c);
const ACUTE = ch(0x301);
const GRAVE = ch(0x300);
const DIAERESIS = ch(0x308);
const CEDILLA = ch(0x327);

const FAMILIES = {
  case: [
    'a', 'A', 'b', 'B', 'ab', 'Ab', 'aB', 'AB', 'navy', 'Navy', 'NAVY', 'nAVY', 'NaVy', 'navy blue', 'Navy Blue', 'NAVY BLUE',
    'st-2026-0441', 'ST-2026-0441', 'St-2026-0441', 'po-884213', 'PO-884213', 'Po-884213', 'ecru', 'Ecru', 'ECRU',
  ],
  digitsAndLetters: [
    '0', '1', '2', '9', '10', '01', '001', '1a', 'a1', 'A1', '1A', 'x1', 'x01', 'x10', 'x2', 'X1', '1 a', '1-a',
    '2026-10-01', '2026-10-1', '2026-9-30', '2026-10-02', '2025-12-31', '2026-10-01T09:00', '01-Oct-2026', '1-Oct-2026',
    'ST-2026-0441', 'ST-2026-441', 'ST-2026-04410', 'SG/26-27/999', 'SG/26-27/1042', 'SG/26-27/1055', 'VGT-2026-771', 'PRE-55120',
  ],
  accents: [
    'e', `e${ACUTE}`, ch(0xe9), ch(0xe8), ch(0xea), ch(0xeb), 'E', ch(0xc9), `E${ACUTE}`, ch(0xc8),
    'Prenatal', `Pr${ch(0xe9)}natal`, `Pre${ACUTE}natal`, 'PRENATAL', `PR${ch(0xc9)}NATAL`, 'prenatal', `pr${ch(0xe9)}natal`,
    'Creme', `Cr${ch(0xe8)}me`, `Cr${ch(0xea)}me`, 'Cafe', `Caf${ch(0xe9)}`, 'cafe', `Ecru`, `${ch(0xc9)}cru`,
    `Fa${CEDILLA}ade`, `Fa${ch(0xe7)}ade`, 'Facade', `Na${ch(0xef)}ve`, `Nai${DIAERESIS}ve`, 'Naive', `a${CEDILLA}${ACUTE}`, `a${ACUTE}${CEDILLA}`,
    `${ch(0xe0)}`, `a${GRAVE}`, ch(0xe1), ch(0xe2), ch(0xe4), ch(0xe5), ch(0xe3),
  ],
  specialLetters: [
    `Wei${ch(0xdf)}`, 'Weiss', 'WEISS', 'Weis', `${ch(0x17f)}s`, `M${ch(0xf8)}rkebl${ch(0xe5)}`, 'Morkebla', 'Mork', `M${ch(0xd8)}RK`,
    `${ch(0xc6)}ble`, 'AEble', 'Aeble', `${ch(0xe6)}ble`, `${ch(0x153)}uvre`, 'oeuvre', `${ch(0x152)}UVRE`, `${ch(0x142)}odz`, 'lodz',
    `${ch(0xf0)}a`, 'da', `${ch(0xfe)}orn`, 'thorn', 'zz', `${ch(0x131)}stanbul`, 'Istanbul', `${ch(0x130)}stanbul`, 'istanbul',
    `l${ch(0xb7)}l`, `${ch(0x140)}l`, 'll', 'l l', `${ch(0x111)}uro`, 'duro', `${ch(0x127)}a`, 'ha',
  ],
  punctuationAndSpaces: [
    'Navy Blue', 'NavyBlue', 'Navy-Blue', 'Navy_Blue', 'Navy/Blue', 'Navy.Blue', 'Navy  Blue', `Navy${NBSP}Blue`, `Navy${EN_SPACE}Blue`,
    'Navy\tBlue', 'navy blue', 'ST/2026/0441', 'ST-2026-0441', 'ST_2026_0441', 'ST 2026 0441', 'ST20260441', 'ST.2026.0441',
    'PO-884213', 'PO 884213', 'PO_884213', 'PO884213', 'PO#884213', 'PO:884213', '(PO) 884213', "Men's", `Men${RIGHT_QUOTE}s`,
    `Men${LEFT_QUOTE}s`, 'Mens', 'Men s', `a-b`, `a${EN_DASH}b`, `a${EM_DASH}b`, '"Navy"', `${LEFT_DQUOTE}Navy`, 'a&b', 'a+b', 'a$b', 'a%b',
  ],
  emptyAndInvisible: [
    '', null, ' ', '  ', '\t', NBSP, 'a', ' a', 'a ', `a${ch(0x1)}b`, 'ab', `a${ch(0xad)}b`, `a${ch(0x200b)}b`, 'a b', `${ch(0xfeff)}a`,
    '-', '_', '.', '0', 'A',
  ],
  symbolsAndCurrency: [
    '$', ch(0x20ac), ch(0x20b9), ch(0xa3), ch(0xa5), ch(0xa2), ch(0xa4), '100$', '$100', `${ch(0x20b9)}100`, `${ch(0x20ac)}100`,
    '#', '%', '&', '*', '@', '+', '<', '=', '>', '|', '~', '^', '`', ch(0xb0), ch(0xa9), ch(0xae), ch(0x2122), 'TM', 'tm',
    ch(0x2116), 'No', ch(0xbd), '1/2', `1${ch(0x2044)}2`, ch(0xb2), '2', ch(0xaa), 'a', `30${ch(0x2103)}`, '30C', ch(0x2026), '...',
  ],
  realistic: [
    'Flame Scarlet 18-1662 TCX', 'Flame Scarlet', 'flame scarlet 18-1662 tcx', 'Classic Blue 19-4052', '19-4052', 'Navy', 'Black',
    'Dusty Rose', 'Dusty rose', 'Ecru', 'White', 'Off White', 'Off-White', 'OffWhite', 'Soft Blue', 'Grey Melange', `Grey M${ch(0xe9)}lange`,
    "Men's Slim Fit Polo", "Girls' Printed Tee", 'Baby 3-pack Bodysuit', 'JOMO', 'VGT', `Pr${ch(0xe9)}natal`, 'Prenatal BV',
    'ST-2026-0441', 'ST-2026-0512', 'ST-2026-0588', 'PO-884213', 'PO-884214', 'VGT-2026-771', 'PRE-55120',
    'CPK/26-27/1001', 'CPK/26-27/1002', 'PKL/26-27/0007', 'Rotterdam', 'Hamburg DC', 'Antwerp', 'Venlo DC',
  ],
};

const CASES = Object.entries(FAMILIES).map(([family, strings]) => ({ id: `localeCompare/${family}`, fn: localeCompareRows, args: [strings] }));

test('localeCompare parity fixtures', () => {
  const { count } = writeFixtures('jsLocaleCompare', CASES);
  expect(count).toBe(CASES.length);
});
