/**
 * Buyer document templates on the real API (/api/v1/export-docs/templates).
 *
 * The e2e seed (db/e2eseed/V20260928162700) gives buyer "JOMO BV" two ACTIVE
 * packing-list templates, a DRAFT v2 of one, and an invoice template. The AI reader
 * has no key on the e2e stack, so the upload spec answers POST .../extract from a
 * fixture — a POST, which the service worker never intercepts. Two specs go to the
 * real API: a file that is not a packing list or invoice is refused by the check that
 * runs before the AI, and a genuine one reaches the "reader is not configured" answer.
 *
 * Every template a spec creates gets a unique code, so the specs can run again on the
 * same stack.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { goTo, settle } from '../sample-requests/helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(path.join(here, '../../fixtures/ai/template-extraction-prenatal.json'), 'utf8'));
const LIST = '/export-docs/templates/list';
const XLSX = { name: 'prenatal-template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK\u0003\u0004 e2e') };

const run = Date.now().toString(36).toUpperCase();
const PL_NAME = `E2E Prenatal PL ${run}`;
const PL_CODE = `E2E-PRENATAL-PL-${run}`;

/** The fixture, with codes and names no earlier run has used. */
const fixtureForRun = () => {
  const result = JSON.parse(JSON.stringify(FIXTURE));
  result.documents.forEach((d) => {
    d.suggestedCode = `${d.suggestedCode}-${run}`;
    d.suggestedName = `${d.suggestedName} ${run}`;
  });
  return result;
};

/**
 * A one-page PDF with a real text layer, written out here because no PDF library is a
 * dependency. The API reads its text before any AI is asked, so this is a genuine file.
 */
const textPdf = (name, lines) => {
  const text = lines.map((l, i) => `BT /F1 12 Tf 72 ${760 - i * 18} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => {
    const at = body.length;
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(body, 'latin1') };
};

/** Opens the upload dialog for a buyer, puts the file in and asks for the reading. */
const uploadForReading = async (page, file) => {
  await goTo(page, LIST);
  await openBuyer(page, 'JOMO BV');
  await page.getByRole('button', { name: /Upload buyer document/ }).click();
  const dialog = page.getByRole('dialog', { name: "Upload a buyer's document" });
  await dialog.locator('input[type=file]').setInputFiles(file);
  await dialog.getByRole('button', { name: 'Read the document' }).click();
  return dialog;
};

/** One template family's card on the register, by its template code. */
const familyCard = (page, code) => page.locator(`[data-template-code="${code}"]`);

const openBuyer = async (page, name) => {
  await page.getByRole('button', { name: `${name} templates` }).click();
  await expect(page.getByRole('heading', { name, level: 4 })).toBeVisible();
};

test.describe.serial('Buyer templates', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('the register lists templates by buyer, several per document type', async ({ page }) => {
    await goTo(page, LIST);
    await openBuyer(page, 'JOMO BV');
    await expect(page.getByText('JOMO BV - Packing List (Sea)').first()).toBeVisible();
    await expect(page.getByText('JOMO BV - AMG Packing List').first()).toBeVisible();
    await expect(page.getByText('Draft v2 in progress')).toBeVisible();
    // The AMG packing list is scoped to the sub-client (the AMG sticker is too).
    await expect(familyCard(page, 'JOMO-PL-AMG').getByText('Sub-client AMG')).toBeVisible();

    await page.getByRole('button', { name: 'Standard & any-buyer templates' }).click();
    await expect(page.getByText('Standard Indian Export — Packing List')).toBeVisible();
    await expect(page.getByText('Standard Indian Export — Commercial Invoice')).toBeVisible();
  });

  test('an uploaded document is reviewed against its source and saved as two drafts', async ({ page }) => {
    await page.route('**/export-docs/templates/extract', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(fixtureForRun()),
    }));
    // The e2e stack has no working file storage (its GCS bucket answers 403 after ~15 s);
    // the source file is stored first, so it is answered here to keep the spec fast.
    await page.route('**/files/upload', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ fileId: '00000000-0000-4000-8000-00000000e2e1', originalFilename: XLSX.name }),
    }));
    await uploadForReading(page, XLSX);

    await expect(page).toHaveURL(/\/export-docs\/templates\/import/);
    await expect(page.getByText('Review the reading')).toBeVisible();
    await expect(page.getByText(/looks like it is for .PRENATAL MOEDER EN KIND BV/)).toBeVisible();

    // A row's citation shows its cell in the source grid (the SELLER box, on the header tab).
    await page.getByRole('tab', { name: 'Header & parties' }).click();
    await page.getByRole('button', { name: 'Show INVOICE!A2 in the document' }).click();
    await expect(page.locator('td[data-cell="1:0"]')).toHaveCSS('background-color', 'rgb(255, 241, 184)');

    // The packing list: rename it, and keep a line the reader did not account for.
    await page.getByRole('tab', { name: /Packing List/ }).first().click();
    await page.locator('input[name="templateName"]').fill(PL_NAME);
    const missed = page.locator('.ant-list-item').filter({ hasText: 'Licence no Client:' });
    await missed.getByRole('button', { name: /Add as/ }).click();
    await page.getByRole('menuitem', { name: 'Header field' }).click();
    await page.getByRole('tab', { name: 'Header & parties' }).click();
    await expect(page.locator('input[value="Licence no Client"]')).toBeVisible();

    await page.getByRole('button', { name: 'Save 2 drafts' }).click();
    await expect(page).toHaveURL(/\/export-docs\/templates\/list\?buyer=buyer:\d+&highlight=/);
    await expect(page.getByText('Just saved')).toHaveCount(2);
    await expect(page.getByText(PL_NAME)).toBeVisible();
  });

  test('publishing a new version retires only the previous version of that template', async ({ page }) => {
    await goTo(page, LIST);
    await openBuyer(page, 'JOMO BV');
    await familyCard(page, PL_CODE).getByRole('button', { name: /Open/ }).click();
    await expect(page).toHaveURL(/\/export-docs\/templates\/edit\/\d+/);

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.ant-tag').filter({ hasText: 'Active' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'New version' }).click();
    await expect(page.getByText(/v2$/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.ant-tag').filter({ hasText: 'Active' }).first()).toBeVisible();

    await goTo(page, LIST);
    await openBuyer(page, 'JOMO BV');
    await expect(familyCard(page, PL_CODE).getByText('1 earlier version(s)')).toBeVisible();
    await expect(familyCard(page, PL_CODE).getByText('v2', { exact: true })).toBeVisible();
    // The buyer's other packing-list templates are untouched.
    await expect(familyCard(page, 'JOMO-PL-AMG').locator('.ant-tag').filter({ hasText: /^active$/i })).toBeVisible();
  });

  test('a new packing list for a buyer with several templates must pick one', async ({ page }) => {
    await goTo(page, '/export-docs/packing-lists/list');
    await page.getByRole('button', { name: /New Packing List/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New Packing List' });
    await dialog.locator('.ant-select').first().click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'JOMO BV' }).first().click();
    await settle(page);

    const picker = dialog.locator('#templateId').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
    await expect(dialog.getByText('This buyer has several — pick one')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create packing list' })).toBeDisabled();

    await picker.click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'JOMO BV - AMG Packing List' }).first().click();
    const create = dialog.getByRole('button', { name: 'Create packing list' });
    await expect(create).toBeEnabled();
    await create.click();
    await expect(page).toHaveURL(/\/export-docs\/packing-lists\/edit\/\d+/);
    // The document is made with the picked template, and keeps it.
    await expect(page.getByText('JOMO BV - AMG Packing List v1').first()).toBeVisible();
  });

  test('a file that is not a packing list or invoice is refused before it is read', async ({ page }) => {
    const letter = textPdf('meeting-note.pdf', ['Dear Sir,', 'Thank you for the meeting of Monday.', 'Kind regards']);
    const dialog = await uploadForReading(page, letter);

    await expect(dialog.getByText('This file cannot become a template')).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByText(/does not look like a packing list or an invoice/)).toBeVisible();
    // Nothing to review: the user stays on the register, and can still build the template by hand.
    await expect(page).toHaveURL(/\/export-docs\/templates\/list/);
    await expect(dialog.getByRole('button', { name: 'Build it by hand' })).toBeVisible();
  });

  test('when the AI is not configured the user can still build the template by hand', async ({ page }) => {
    const packingList = textPdf('jomo-packing-list.pdf', ['PACKING LIST', 'CTN NO   COLOUR   QTY   NET WT   GROSS WT']);
    const dialog = await uploadForReading(page, packingList);
    await expect(dialog.getByText('AI reading is not available here')).toBeVisible({ timeout: 30000 });
    await dialog.getByRole('button', { name: 'Build it by hand' }).click();
    await expect(page.getByRole('dialog', { name: 'New document template' })).toBeVisible();
  });
});
