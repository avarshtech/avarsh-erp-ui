// Parity fixtures for src/utils/expDocPoKeys.js -> erp-purchase PoKeys (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
import { test, expect } from 'vitest';
import * as poKeys from '../../src/utils/expDocPoKeys.js';
import { writeFixtures } from './writeFixtures.js';

const { poText, poKey, poRefOf } = poKeys;

// Built from code points so none of them hides in the source as an ordinary-looking space
const SEP = String.fromCharCode(0x241f); // the key separator, as expDocPoKeys.js has it
const NBSP = String.fromCharCode(0xa0);
const BOM = String.fromCharCode(0xfeff);
const EM_SPACE = String.fromCharCode(0x2003);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const CONTROL_A = String.fromCharCode(0x01);

const POTEXT = [
  ['null', null],
  ['empty', ''],
  ['blank', '   '],
  ['padded', ' PO-884213 '],
  ['plain', 'PO-884213'],
  ['inner-spaces-kept', ' PO 4500 123  '],
  ['number', 4500123],
  ['zero-is-text', 0],
  // JavaScript's trim takes the no-break space and the BOM, and leaves control characters
  ['no-break-spaces', `${NBSP}PO-1${NBSP}`],
  ['bom-and-line-breaks', `${BOM}\tPO-2\r\n`],
  ['control-char-kept', `${CONTROL_A}PO-3`],
  ['unicode-spaces', `${EM_SPACE}PO-4${IDEOGRAPHIC_SPACE}`],
];

const POKEY = [
  ['po-and-destination', { buyerPoNo: 'PO-A', destination: 'Hamburg DC' }],
  ['po-only', { buyerPoNo: 'PO-A', destination: null }],
  ['destination-only', { buyerPoNo: null, destination: 'Hamburg DC' }],
  ['neither', { buyerPoNo: null, destination: null }],
  ['null-ref', null],
  ['empty-object', {}],
  ['trimmed', { buyerPoNo: ' PO-A ', destination: '  Hamburg DC\t' }],
  ['blank-parts', { buyerPoNo: '', destination: '   ' }],
  ['numeric-po', { buyerPoNo: 4500123, destination: 'Venlo DC' }],
  ['no-break-space', { buyerPoNo: `${NBSP}PO-B`, destination: `Rotterdam${NBSP}` }],
  // A packing-list row is a PO reference too: the other fields do not count
  ['row-shaped', { id: '5:x', buyerPoNo: 'PO-884213', destination: 'Rotterdam', styleNo: 'ST-2026-0441', cartonFrom: 1, cartonTo: 47 }],
];

const POREFOF = [
  ['po-and-destination', `PO-A${SEP}Hamburg DC`],
  ['po-only', `PO-A${SEP}`],
  ['destination-only', `${SEP}Hamburg DC`],
  ['separator-only', SEP],
  ['empty', ''],
  ['no-separator', 'PO-A'],
  ['extra-part-ignored', `PO-A${SEP}Hamburg DC${SEP}spare`],
  // String(null) is "null": the browser reads a null key as PO "null"
  ['null-key-reads-as-text', null],
  ['spaces-kept', `  ${SEP}  `],
  ['number', 4500123],
  ['round-trip', poKey({ buyerPoNo: ' PO-9 ', destination: 'Antwerp' })],
];

const CASES = [
  ...POTEXT.map(([id, v]) => ({ id: `poText/${id}`, fn: poText, args: [v] })),
  ...POKEY.map(([id, p]) => ({ id: `poKey/${id}`, fn: poKey, args: [p] })),
  ...POREFOF.map(([id, key]) => ({ id: `poRefOf/${id}`, fn: poRefOf, args: [key] })),
];

test('expDocPoKeys parity fixtures', () => {
  const { count } = writeFixtures('expDocPoKeys', CASES, { api: poKeys });
  expect(count).toBe(CASES.length);
});
