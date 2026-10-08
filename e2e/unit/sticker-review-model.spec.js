// Node-only: the carton-sticker side of the upload review — its lines as review elements, the
// patches that bind, remove and add one, the blocker, and the summary. No browser, no login, no API.
//   npx playwright test e2e/unit/sticker-review-model.spec.js --project=unit
import { test, expect } from '@playwright/test';
import {
  ASK_WHEN_PRINTING, appendStickerLinePatch, parseStickerLineId, stickerLineElements, stickerReadParts,
} from '../../src/pages/expdoc/template/review/stickerReviewModel.js';
import {
  bindElementPatch, elementsOf, readerNotes, removeElementPatch, whatWasRead,
} from '../../src/pages/expdoc/template/review/attentionModel.js';
import {
  ADD_AS, addChoicesFor, addMissedPatch, blockingIssues,
} from '../../src/pages/expdoc/template/review/reviewModel.js';

const line = (key, label, binding, kind = 'FIELD') => ({ key, kind, label, binding });
const sticker = (faces) => ({
  docType: 'STICKER', name: 'VGT', templateCode: 'VGT-STK', stickerLayout: { paperDefault: 'A4_2UP', faces, mandatoryFields: [] },
});
/** A patch applied as the review applies it: merged into the template. */
const apply = (t, patch) => ({ ...t, ...patch });
const lineOf = (t, face, key) => t.stickerLayout.faces.find((f) => f.key === face).lines.find((l) => l.key === key);

const VGT = sticker([
  {
    key: 'MAIN',
    lines: [
      line('headline', null, 'fixed:VGT'),
      line('order', 'ORDER #', null),
      line('order2', 'ORDER #', null),
      line('batch', 'BATCH #', null),
      line('grid', null, 'carton.sizeQty', 'SIZE_GRID'),
    ],
  },
  { key: 'SIDE', lines: [line('ean', 'EAN', 'carton.eanBySize', 'BARCODE'), line('cartonNo', 'CARTON NO', null)] },
]);

test('a sticker line is named by the id the reader notes use', () => {
  expect(parseStickerLineId('faces:MAIN.lines:batch')).toEqual({ face: 'MAIN', key: 'batch' });
  expect(parseStickerLineId('sheets:SOLID.columns:qty')).toBeNull();
});

test('every line is an element; only a labelled field line can be given a data source', () => {
  const byId = Object.fromEntries(elementsOf(VGT).map((e) => [e.id, e]));
  expect(byId['faces:MAIN.lines:headline']).toMatchObject({ label: 'VGT', bindable: false });
  expect(byId['faces:MAIN.lines:grid']).toMatchObject({ label: 'Size grid', bindable: false });
  expect(byId['faces:SIDE.lines:ean']).toMatchObject({ label: 'EAN', bindable: false });
  // The key is only a hint while nothing is bound: both "ORDER #" lines would be asked as orderNo now.
  expect(byId['faces:MAIN.lines:batch']).toMatchObject({ bindable: true, binding: null, askKey: 'batchNo' });
  expect(stickerLineElements(VGT).filter((e) => e.label === 'ORDER #').map((e) => e.askKey)).toEqual(['orderNo', 'orderNo']);
});

test('"Ask when printing" is keyed when it is given, so two "ORDER #" lines never share an answer', () => {
  const first = apply(VGT, bindElementPatch(VGT, 'faces:MAIN.lines:order', ASK_WHEN_PRINTING));
  expect(lineOf(first, 'MAIN', 'order').binding).toBe('ask:orderNo');
  const second = apply(first, bindElementPatch(first, 'faces:MAIN.lines:order2', ASK_WHEN_PRINTING));
  expect(lineOf(second, 'MAIN', 'order2').binding).toBe('ask:orderNo2');
  // A key the answer brings from an older reading of the template is not trusted either.
  const stale = apply(first, bindElementPatch(first, 'faces:MAIN.lines:order2', 'ask:orderNo'));
  expect(lineOf(stale, 'MAIN', 'order2').binding).toBe('ask:orderNo2');
  // Only the bound line changes; the other face is the same object.
  expect(second.stickerLayout.faces[1]).toBe(VGT.stickerLayout.faces[1]);
});

test('a line bound to the carton number starts as "{n} OF {N}", as in the editor', () => {
  const numbered = apply(VGT, bindElementPatch(VGT, 'faces:SIDE.lines:cartonNo', 'carton.cartonNo'));
  expect(lineOf(numbered, 'SIDE', 'cartonNo')).toMatchObject({ binding: 'carton.cartonNo', pattern: '{n} OF {N}' });
});

test('"Remove" takes the line off its face', () => {
  const removed = apply(VGT, removeElementPatch(VGT, 'faces:MAIN.lines:batch'));
  expect(removed.stickerLayout.faces[0].lines.map((l) => l.key)).toEqual(['headline', 'order', 'order2', 'grid']);
  expect(removed.stickerLayout.faces[1].lines).toHaveLength(2);
});

test('text the reader left out is added to the first face, as a line to fill or as fixed text', () => {
  expect(addChoicesFor('STICKER')).toEqual([ADD_AS.STICKER_LINE, ADD_AS.STICKER_TEXT]);
  const asLine = apply(VGT, addMissedPatch(VGT, 'SEASON :', ADD_AS.STICKER_LINE));
  const added = asLine.stickerLayout.faces[0].lines.at(-1);
  expect(added).toMatchObject({ kind: 'FIELD', label: 'SEASON', binding: null });
  expect(added.key).toMatch(/^line/);
  // It is then asked about like any line nothing fills.
  expect(elementsOf(asLine).find((e) => e.label === 'SEASON')).toMatchObject({ bindable: true, askKey: 'season' });

  const asText = apply(VGT, addMissedPatch(VGT, ' MADE IN INDIA ', ADD_AS.STICKER_TEXT));
  expect(asText.stickerLayout.faces[0].lines.at(-1)).toMatchObject({ kind: 'FIELD', label: null, binding: 'fixed:MADE IN INDIA' });
  expect(asText.stickerLayout.paperDefault).toBe('A4_2UP');
});

test('a sticker with no line cannot be saved, and a line added to it starts the main face', () => {
  const empty = sticker([]);
  expect(blockingIssues({ template: empty })).toEqual([{ text: 'A carton sticker needs at least one face with a line.', tab: 'sticker' }]);
  const added = apply(empty, appendStickerLinePatch(empty, { label: null, binding: 'fixed:MADE IN INDIA' }));
  expect(added.stickerLayout.faces).toHaveLength(1);
  expect(added.stickerLayout.faces[0]).toMatchObject({ key: 'MAIN', logo: false });
  expect(blockingIssues({ template: added })).toEqual([]);
  // The blocker asks about it, so the reader's own "no sticker lines" note is not repeated.
  const result = { findings: [{ severity: 'ERROR', code: 'NO_FACES', message: 'No sticker lines were read.', document: 0 }] };
  expect(readerNotes({ index: 0 }, result)).toEqual([]);
});

test('what was read, in a few words', () => {
  expect(stickerReadParts(VGT)).toEqual(['2 faces', '7 lines', 'size grid', '1 barcode']);
  expect(whatWasRead(sticker([{ key: 'MAIN', lines: [line('a', 'A', null)] }]))).toBe('1 face · 1 line');
});
