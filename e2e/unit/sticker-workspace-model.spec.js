// Node-only: the carton-sticker print workspace's decisions — which template a run prints, the
// questions a layout asks once per run and where their answers are prefilled from, whether
// barcodes start on, why Generate is blocked, the buyer's layout count, "revised since the last
// run", and how the preview pages.
// No browser, no login, no API.
//   npx playwright test e2e/unit/sticker-workspace-model.spec.js --project=unit
import { test, expect } from '@playwright/test';
import { stickerAskQuestions, stickerTemplateChoice } from '../../src/utils/expDocTemplateSchema.js';
import {
  askDefaults, askPrefillRun, generateBlockReason, hasBarcodeLine, layoutCount, pageGeometry,
  printBarcodesFor, revisedSinceLastRun, runValuesText,
} from '../../src/pages/expdoc/sticker/workspace/stickerWorkspaceModel.js';

const line = (key, label, binding, kind = 'FIELD') => ({ key, kind, label, binding });
const SCA = {
  id: 22,
  templateCode: 'JOMO-STK-SCA',
  version: 2,
  stickerLayout: {
    paperDefault: 'A4_2UP',
    faces: [{
      key: 'MAIN',
      lines: [
        line('order', 'ORDER #', 'carton.buyerPoNo'),
        line('batch', ' BATCH # ', 'ask:batchNo'),
        line('season', null, 'ask:season'),
        line('batchAgain', 'BATCH NO', 'ask:batchNo'),
        line('ean', 'EAN', 'carton.eanBySize', 'BARCODE'),
      ],
    }],
  },
};
const AMG = {
  id: 21,
  templateCode: 'JOMO-STK-AMG',
  version: 1,
  stickerLayout: { faces: [{ key: 'MAIN', lines: [line('grid', null, 'carton.sizeQty', 'SIZE_GRID')] }, { key: 'SIDE', lines: [] }] },
};
const run = (id, templateCode, prints, more = {}) => ({
  id, runNo: `STK/26-27/${1000 + id}`, templateCode, templateVersion: 1, prints, ...more,
});

test('a layout asks one question per ask: key, in layout order, labelled by its first line', () => {
  expect(stickerAskQuestions(SCA.stickerLayout)).toEqual([
    { key: 'batchNo', label: 'BATCH #' },
    { key: 'season', label: 'season' },
  ]);
  expect(stickerAskQuestions(AMG.stickerLayout)).toEqual([]);
  expect(stickerAskQuestions(null)).toEqual([]);
});

test('answers prefill from the run that printed these cartons, else the family\'s latest, never another family', () => {
  const runs = [
    run(1, 'JOMO-STK-SCA', [{ from: 1, to: 47 }]),
    run(2, 'JOMO-STK-SCA', [{ from: 48, to: 61 }]),
    run(3, 'JOMO-STK-AMG', [{ from: 1, to: 61 }]),
  ];
  // A reprint of 10–20 keeps the values cartons 10–20 were printed with.
  expect(askPrefillRun(runs, SCA, [{ from: 10, to: 20 }]).id).toBe(1);
  // Cartons the family never printed start from its latest run.
  expect(askPrefillRun(runs, SCA, [{ from: 62, to: 70 }]).id).toBe(2);
  expect(askPrefillRun(runs, { ...SCA, templateCode: 'JOMO-STK-NEW' }, [{ from: 1, to: 61 }])).toBeNull();
  expect(askPrefillRun(runs, null, [{ from: 1, to: 61 }])).toBeNull();
});

test('a run\'s answer fills each question; one it never gave is blank, and only its own keys count', () => {
  const questions = [{ key: 'batchNo' }, { key: 'constructor' }];
  expect(askDefaults(questions, { askValues: { batchNo: '261505-SR' } })).toEqual({ batchNo: '261505-SR', constructor: '' });
  expect(askDefaults(questions, null)).toEqual({ batchNo: '', constructor: '' });
});

test('barcodes start on only when no selected carton lacks an EAN; the user\'s choice wins after that', () => {
  expect(hasBarcodeLine(SCA.stickerLayout)).toBe(true);
  expect(hasBarcodeLine(AMG.stickerLayout)).toBe(false);
  expect(printBarcodesFor(SCA.stickerLayout, undefined, { count: 0, ranges: [] })).toBe(true);
  expect(printBarcodesFor(SCA.stickerLayout, undefined, { count: 14, ranges: [{ from: 48, to: 61 }] })).toBe(false);
  expect(printBarcodesFor(SCA.stickerLayout, true, { count: 14 })).toBe(true);
  expect(printBarcodesFor(SCA.stickerLayout, false, { count: 0 })).toBe(false);
  // A layout with no barcode line has nothing to switch on.
  expect(printBarcodesFor(AMG.stickerLayout, true, { count: 0 })).toBe(false);
});

test('Generate says what to fix first: the layout, the right, the reprint right, the question, the faces, then the check', () => {
  const ready = { canGenerate: true, blockedReason: null };
  const all = {
    layout: SCA, mustPick: false, blockedByPermission: false, reprintBlocked: false, unanswered: null, noFaces: false, checking: false, check: ready,
  };
  expect(generateBlockReason(all)).toBeNull();
  expect(generateBlockReason({ ...all, layout: null, mustPick: true, blockedByPermission: true }))
    .toBe('Pick the sticker layout to print with.');
  expect(generateBlockReason({ ...all, blockedByPermission: true, reprintBlocked: true }))
    .toBe('You do not hold the right to print these labels.');
  expect(generateBlockReason({ ...all, reprintBlocked: true, unanswered: { key: 'batchNo', label: 'BATCH #' } }))
    .toBe('These cartons were printed already and you do not hold the reprint right.');
  expect(generateBlockReason({ ...all, unanswered: { key: 'batchNo', label: 'BATCH #' }, noFaces: true }))
    .toBe('Answer “BATCH #” before printing.');
  // No face ticked prints nothing, whatever the check says.
  expect(generateBlockReason({ ...all, noFaces: true, checking: true })).toBe('Tick at least one face to print.');
  expect(generateBlockReason({ ...all, checking: true })).toBe('Checking the selected cartons…');
  expect(generateBlockReason({ ...all, check: { canGenerate: false, blockedReason: '14 carton(s) are missing a field this layout prints.' } }))
    .toBe('14 carton(s) are missing a field this layout prints.');
});

test('a run prints the layout picked, a superseded pick its own family, else the family last printed', () => {
  // As rankTemplateCandidates ranks them: only revisions in force, the standard one last.
  const ranked = {
    candidates: [
      { id: 31, templateCode: 'JOMO-STK-AMG' }, { id: 22, templateCode: 'JOMO-STK-SCA' },
      { id: 'SYSTEM-STICKER', templateCode: 'SYSTEM-STICKER', isSystem: true },
    ],
    autoSelectId: null,
  };
  const lastPrinted = { latestTemplateCode: 'JOMO-STK-SCA' };
  expect(stickerTemplateChoice(ranked, { ...lastPrinted, templateId: 31 })).toBe(31);
  expect(stickerTemplateChoice(ranked, { ...lastPrinted, templateId: '31' })).toBe(31);
  // AMG v1 (id 21) was superseded by v2 (id 31) while the page was open: still AMG, not SCA.
  expect(stickerTemplateChoice(ranked, { ...lastPrinted, templateId: 21, pickedCode: 'JOMO-STK-AMG' })).toBe(31);
  // A pick whose whole family was retired falls back to the family last printed.
  expect(stickerTemplateChoice(ranked, { ...lastPrinted, templateId: 9, pickedCode: 'JOMO-STK-OLD' })).toBe(22);
  expect(stickerTemplateChoice(ranked, lastPrinted)).toBe(22);
  // Nothing picked or printed yet: the automatic choice, or none — the user picks.
  expect(stickerTemplateChoice(ranked, {})).toBeNull();
  expect(stickerTemplateChoice({ ...ranked, autoSelectId: 31 }, {})).toBe(31);
  expect(stickerTemplateChoice({ candidates: [], autoSelectId: null })).toBeNull();
});

test('the standard carton marking is offered to every buyer, so it is not counted as one of theirs', () => {
  expect(layoutCount([
    { value: 21, label: 'AMG v1', isSystem: false },
    { value: 22, label: 'SCA v2', isSystem: false },
    { value: 'SYSTEM-STICKER', label: 'Standard export carton marking v1', isSystem: true },
  ])).toBe(2);
  expect(layoutCount([{ value: 'SYSTEM-STICKER', isSystem: true }])).toBe(0);
});

test('a layout revised since this packing list last printed with its family is noted', () => {
  const runs = [run(1, 'JOMO-STK-SCA', [{ from: 1, to: 61 }]), run(2, 'JOMO-STK-AMG', [{ from: 1, to: 61 }], { templateVersion: 5 })];
  expect(revisedSinceLastRun(runs, SCA)).toEqual({ runNo: 'STK/26-27/1001', from: 1, to: 2 });
  // The family's latest run decides: printed with v2 already, there is nothing to note.
  expect(revisedSinceLastRun([...runs, run(3, 'JOMO-STK-SCA', [{ from: 1, to: 5 }], { templateVersion: 2 })], SCA)).toBeNull();
  expect(revisedSinceLastRun(runs, { ...SCA, templateCode: 'JOMO-STK-NEW' })).toBeNull();
  expect(revisedSinceLastRun(runs, null)).toBeNull();
});

test('a preview page holds whole cartons on whole sheets', () => {
  // Two faces, two labels a sheet: one carton a page.
  expect(pageGeometry('A4_2UP', 2, 61)).toEqual({ cartonsPerPage: 1, sheetsPerPage: 1, pageCount: 61 });
  // Two faces on 1-up paper: one carton across two sheets.
  expect(pageGeometry('A4_1UP', 2, 61)).toEqual({ cartonsPerPage: 1, sheetsPerPage: 2, pageCount: 61 });
  // One face on 2×2 paper: four cartons a sheet.
  expect(pageGeometry('A4_2X2', 1, 61)).toEqual({ cartonsPerPage: 4, sheetsPerPage: 1, pageCount: 16 });
  // Three faces on 2×2: lcm(4, 3) = 12 labels, four cartons on three sheets; an empty scope is still one page.
  expect(pageGeometry('A4_2X2', 3, 0)).toEqual({ cartonsPerPage: 4, sheetsPerPage: 3, pageCount: 1 });
  // A paper the renderer does not know prints as A4.
  expect(pageGeometry('constructor', 1, 5)).toEqual({ cartonsPerPage: 1, sheetsPerPage: 1, pageCount: 5 });
});

test('a run\'s values read by the labels they were asked with', () => {
  expect(runValuesText({ askValues: { batchNo: '261505-SR', season: 'AW26' }, askLabels: { batchNo: 'BATCH #' } }))
    .toBe('BATCH #: 261505-SR · season: AW26');
  expect(runValuesText({ askValues: { constructor: 'X' } })).toBe('constructor: X');
  expect(runValuesText({})).toBe('');
});
