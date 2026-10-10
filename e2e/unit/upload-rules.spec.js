// Node-only: what the buyer-document upload accepts before a file leaves the browser. No browser, no login, no API.
//   npx playwright test e2e/unit/upload-rules.spec.js --project=unit
import { test, expect } from '@playwright/test';
import {
  ACCEPT, CONTAINS, MAX_MB, WRONG_TYPE, containsHint, fileProblem,
} from '../../src/pages/expdoc/template/upload/uploadRules.js';

const MB = 1024 * 1024;
const file = (name, size = 2048) => ({ name, size });

test('a PDF, an Excel file or a Word .docx is accepted, whatever the case of its extension', () => {
  ['buyer.pdf', 'VGT.PDF', 'packing.xlsx', 'old-packing.xls', 'LIZANNE.docx', 'LIZANNE.DOCX'].forEach((name) => {
    expect(fileProblem(file(name)), name).toBeNull();
  });
  expect(ACCEPT).toBe('.pdf,.xlsx,.xls,.docx');
});

test('an old Word .doc and any other type are refused, naming what is accepted', () => {
  ['LIZANNE.doc', 'mark.png', 'notes.txt', 'archive.zip', 'no-extension'].forEach((name) => {
    expect(fileProblem(file(name)), name).toBe(WRONG_TYPE);
  });
  expect(WRONG_TYPE).toBe('Upload the buyer\'s document as a PDF, an Excel file (.xlsx or .xls) or a Word file (.docx).');
});

test('up to 10 MB is accepted; one byte more is refused', () => {
  expect(MAX_MB).toBe(10);
  expect(fileProblem(file('large.pdf', 10 * MB))).toBeNull();
  expect(fileProblem(file('large.pdf', 10 * MB + 1))).toBe('The file is larger than 10 MB.');
});

test('an empty file is refused before it is sent', () => {
  expect(fileProblem(file('empty.pdf', 0))).toBe('The file is empty.');
  expect(fileProblem(file('empty.docx', 0))).toBe('The file is empty.');
});

test('"Carton sticker" is a choice of its own, with a hint on what to upload', () => {
  expect(CONTAINS.map((c) => c.value)).toEqual(['AUTO', 'PACKING_LIST', 'INVOICE', 'STICKER']);
  expect(CONTAINS.find((c) => c.value === 'STICKER').label).toBe('Carton sticker');
  expect(containsHint('STICKER')).toBe('One example of each sticker layout is enough — not the whole print run.');
  expect(containsHint('AUTO')).toBeNull();
});
