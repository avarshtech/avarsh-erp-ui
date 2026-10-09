// Node-only: the carton-sticker editor's model and the keys of its per-run questions. No browser, no login, no API.
//   npx playwright test e2e/unit/sticker-editor-model.spec.js --project=unit
import { test, expect } from '@playwright/test';
import {
  STICKER_HIDDEN_FIELDS, askKeyFor, askKeysExcept, catalogueForReader, isBindable,
} from '../../src/utils/expDocTemplateSchema.js';
import { DOC_TYPE } from '../../src/utils/expDocConstants.js';
import { buildStickerSheetHtml } from '../../src/utils/expDocStickerHtml.js';
import {
  barcodeSourceChanges, fieldBindingChanges, newFace, newLine, nextFaceKey, switchKind,
} from '../../src/pages/expdoc/template/editor/sticker/stickerEditorModel.js';

// What the API's StickerNormaliser and the renderer accept as a per-run question's key.
const ASK_KEY = /^[a-z][A-Za-z0-9]{0,39}$/;

test.describe('per-run question keys', () => {
  test('a label becomes camelCase, and "#" reads as "No"', () => {
    expect(askKeyFor('CUSTOMER ORDER NO.')).toBe('customerOrderNo');
    expect(askKeyFor('BATCH #')).toBe('batchNo');
    expect(askKeyFor('ASSORTMENT DIVISION')).toBe('assortmentDivision');
  });

  test('a second and a third "ORDER #" get keys of their own', () => {
    expect(askKeyFor('ORDER #')).toBe('orderNo');
    expect(askKeyFor('ORDER #', ['orderNo'])).toBe('orderNo2');
    expect(askKeyFor('ORDER #', ['orderNo', 'orderNo2'])).toBe('orderNo3');
  });

  test('accents are dropped and ß reads as ss', () => {
    expect(askKeyFor('Größe / Quantité')).toBe('grosseQuantite');
  });

  test('a key that would start with a digit starts with "q"', () => {
    expect(askKeyFor('2nd mark')).toBe('q2ndMark');
  });

  test('a line with no label asks "headline"', () => {
    expect(askKeyFor(null)).toBe('headline');
    expect(askKeyFor('   ')).toBe('headline');
    expect(askKeyFor('', ['headline'])).toBe('headline2');
  });

  test('a long label is cut to 40 characters, and a suffix still fits in 40', () => {
    const label = 'Customer article name as printed on the outer carton for the store';
    const first = askKeyFor(label);
    expect(first).toHaveLength(40);
    const second = askKeyFor(label, [first]);
    expect(second).toHaveLength(40);
    expect(second).toBe(`${first.slice(0, 39)}2`);
    const tenth = askKeyFor(label, [first, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${first.slice(0, 39)}${n}`)]);
    expect(tenth).toBe(`${first.slice(0, 38)}10`);
  });

  test('every key is one the API and the renderer accept', () => {
    ['CUSTOMER ORDER NO.', 'BATCH #', '2nd', '', '###', 'Größe', '!!!', 'PO', null].forEach((label) => {
      const key = askKeyFor(label);
      expect(key, String(label)).toMatch(ASK_KEY);
      expect(isBindable(`ask:${key}`), key).toBe(true);
    });
  });

  test('the keys taken by other lines leave out the line itself', () => {
    const faces = [
      { key: 'MAIN', lines: [{ binding: 'ask:batchNo' }, { binding: 'carton.buyerPoNo' }, { binding: 'ask:orderNo' }] },
      { key: 'SIDE', lines: [{ binding: 'ask:season' }, { binding: 'fixed:BJJI' }, { binding: null }] },
    ];
    expect(askKeysExcept(faces, 0, 0)).toEqual(['orderNo', 'season']);
    expect(askKeysExcept(faces, 1, 0)).toEqual(['batchNo', 'orderNo']);
    // Renaming a line re-derives its key against the others only, so it keeps its own.
    expect(askKeyFor('ORDER #', askKeysExcept(faces, 0, 2))).toBe('orderNo');
    // The same key on another face is still taken.
    const twin = [{ lines: [{ binding: 'ask:orderNo' }] }, { lines: [{ binding: 'ask:orderNo' }] }];
    expect(askKeyFor('ORDER #', askKeysExcept(twin, 1, 0))).toBe('orderNo2');
  });
});

test.describe('faces and lines', () => {
  test('face keys run MAIN, SIDE, FACE3, FACE4', () => {
    expect(nextFaceKey([])).toBe('MAIN');
    expect(nextFaceKey([{ key: 'MAIN' }])).toBe('SIDE');
    expect(nextFaceKey([{ key: 'MAIN' }, { key: 'SIDE' }])).toBe('FACE3');
    expect(nextFaceKey([{ key: 'MAIN' }, { key: 'SIDE' }, { key: 'FACE3' }])).toBe('FACE4');
  });

  test('after MAIN is deleted, faces added never repeat a key', () => {
    const faces = [{ key: 'SIDE' }, { key: 'FACE3' }];
    faces.push(newFace(nextFaceKey(faces)));
    faces.push(newFace(nextFaceKey(faces)));
    expect(faces.map((f) => f.key)).toEqual(['SIDE', 'FACE3', 'MAIN', 'FACE4']);
  });

  test('a new face is an empty, bordered LINES face, with no exporter logo to switch on', () => {
    expect(newFace('MAIN')).toEqual({
      key: 'MAIN', title: 'MAIN MARK', render: 'LINES', border: true, caption: null, symbol: null, lines: [],
    });
  });

  test('new lines have unique keys and their kind\'s defaults', () => {
    const lines = [newLine(), newLine('SIZE_GRID'), newLine('BARCODE')];
    expect(new Set(lines.map((l) => l.key)).size).toBe(3);
    expect(lines[0]).toMatchObject({ kind: 'FIELD', label: null, binding: null });
    expect(lines[1]).toMatchObject({ binding: 'carton.sizeQty', grid: { cells: 'QTY', sizes: 'ALL', totals: true } });
    expect(lines[2]).toMatchObject({
      binding: 'carton.eanBySize', barcode: { symbology: 'EAN13', perSize: true, showText: true, heightMm: 12 },
    });
  });

  test('switching kind keeps the key, label and font, and drops the old kind\'s settings', () => {
    const field = { key: 'po', kind: 'FIELD', label: 'PO NO', binding: 'carton.buyerPoNo', bold: true, fontPt: 14, suffix: ' X' };
    expect(switchKind(field, 'SIZE_GRID')).toEqual({
      key: 'po', kind: 'SIZE_GRID', label: 'PO NO', bold: true, fontPt: 14,
      binding: 'carton.sizeQty', grid: { cells: 'QTY', sizes: 'ALL', totals: true },
    });
  });

  test('the carton number always starts as "{n} OF {N}", never a bare number', () => {
    expect(fieldBindingChanges({ binding: 'carton.nOfN' }, 'carton.cartonNo')).toEqual({ binding: 'carton.cartonNo', pattern: '{n} OF {N}' });
    expect(fieldBindingChanges({ binding: null }, 'carton.cartonNo')).toEqual({ binding: 'carton.cartonNo', pattern: '{n} OF {N}' });
    // A pattern of the same tokens stays; one the new field cannot fill goes.
    expect(fieldBindingChanges({ binding: 'carton.nOfN', pattern: '{n}/{N}' }, 'carton.cartonNo')).toEqual({ binding: 'carton.cartonNo' });
    expect(fieldBindingChanges({ binding: 'carton.dimensions', pattern: '{L}x{B}x{H}CMS' }, 'carton.buyerPoNo').pattern).toBeUndefined();
  });

  test('a barcode of the carton number is Code 128; the EAN of each size prints one per size', () => {
    const ean = { binding: 'carton.eanBySize', barcode: { symbology: 'EAN13', perSize: true, heightMm: 20 } };
    expect(barcodeSourceChanges(ean, 'carton.cartonNo')).toEqual({
      binding: 'carton.cartonNo', barcode: { symbology: 'CODE128', perSize: false, heightMm: 20 },
    });
    expect(barcodeSourceChanges({ barcode: { symbology: 'CODE128' } }, 'carton.eanBySize').barcode)
      .toEqual({ symbology: 'EAN13', perSize: true });
  });
});

// Owner, 2026-10-09: a carton sticker never carries the exporter logo, by any route.
test.describe('no exporter logo on a carton sticker', () => {
  test('the AI reader and the sticker field pickers are never offered it', () => {
    const sticker = catalogueForReader(DOC_TYPE.STICKER).map((f) => f.path);
    expect(sticker).toContain('exporter.country');
    expect(sticker).not.toContain('exporter.logoUrl');
    expect(STICKER_HIDDEN_FIELDS).toEqual(['exporter.logoUrl']);
    // Packing lists and invoices keep their own letterhead rules.
    expect(catalogueForReader(DOC_TYPE.PACKING_LIST).map((f) => f.path)).toContain('exporter.logoUrl');
  });

  test('a face prints no logo, even from a layout saved while the old switches were on', () => {
    const face = {
      key: 'MAIN', title: 'MAIN MARK', render: 'LINES', border: true, logo: true,
      lines: [{ key: 'po', kind: 'FIELD', label: 'PO NO', binding: 'carton.buyerPoNo' }],
    };
    const html = buildStickerSheetHtml([{ cartonNo: 1, buyerPoNo: 'PO-884213' }], {
      layout: { faces: [face] }, paper: 'A4_1UP', ctx: { showLogo: true, exporter: { name: 'Avarsh' } },
    });
    expect(html).toContain('PO-884213');
    expect(html).not.toMatch(/<img/i);
  });
});
