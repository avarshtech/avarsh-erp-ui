/**
 * Buyer document templates on the real API (/api/v1/export-docs/templates).
 *
 * The e2e seed (db/e2eseed/V20260928162700) gives buyer "JOMO BV" two ACTIVE
 * packing-list templates, a DRAFT v2 of one, and an invoice template. The AI reader
 * has no key on the e2e stack, so the upload spec answers POST .../extract from a
 * fixture — a POST, which the service worker never intercepts. Two specs go to the
 * real API: a file that is not a packing list or invoice is refused by the check that
 * runs before the AI, and a genuine one reaches the "reader is not configured" answer.
 * "New buyer template" is driven for JOMO BV (has templates: a new version) and for the
 * seeded "Target Corporation" (none: straight to how to make one).
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

/** Picks an option in the open select dropdown. */
const pickOption = async (page, select, text) => {
  await select.click();
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: text }).first().click();
};

/** The review's "Needs your attention" item whose text includes `text`. */
const attentionItem = (page, text) => page.getByRole('list', { name: 'Needs your attention' })
  .getByRole('listitem').filter({ hasText: text });

/** Answers a "nothing fills it yet" item with text printed on every document. */
const fillWithFixedText = async (page, label, text) => {
  await attentionItem(page, `“${label}” — nothing fills it yet`).getByRole('button', { name: 'Choose what fills it' }).click();
  const chooser = page.locator('.ant-popover').filter({ hasText: `What should print for “${label}”?` });
  await chooser.getByText('Fixed text').click();
  await chooser.getByPlaceholder('Text printed verbatim, e.g. a licence number').fill(text);
  await chooser.getByRole('button', { name: 'Apply' }).click();
};

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
    // There is no sub-client concept: a sub-client code still stored on the API row
    // never reaches the screen.
    await expect(familyCard(page, 'JOMO-PL-AMG').getByText(/Sub-client/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Standard & any-buyer templates' }).click();
    await expect(page.getByText('Standard Indian Export — Packing List')).toBeVisible();
    await expect(page.getByText('Standard Indian Export — Commercial Invoice')).toBeVisible();

    // Only buyers that have templates are listed; a new buyer starts from the page header.
    await expect(page.getByText('Buyers without templates')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Target Corporation templates' })).toHaveCount(0);
  });

  test('an uploaded document is checked on one page and saved as two drafts', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: 'Check the new templates' })).toBeVisible();
    await expect(page.getByText(/looks like it is for .PRENATAL MOEDER EN KIND BV/)).toBeVisible();
    // The uploaded file is not split beside the review; it opens when asked for.
    await expect(page.locator('td[data-cell="0:0"]')).toHaveCount(0);

    // The invoice (first tab): a column nothing fills is shown in the file, then given its text.
    const hanger = attentionItem(page, '“HANGER” — nothing fills it yet');
    await hanger.getByRole('button', { name: 'Show in file' }).click();
    await expect(page.locator('td[data-cell="5:3"]')).toHaveCSS('background-color', 'rgb(255, 241, 184)');
    await page.keyboard.press('Escape');
    await fillWithFixedText(page, 'HANGER', 'WITHOUT HANGER');
    await expect(hanger).toHaveCount(0);
    // A sentence the reader left out becomes a note.
    const meis = attentionItem(page, 'We intend to claim rewards under MEIS');
    await meis.getByRole('button', { name: /Add to template/ }).click();
    await page.getByRole('menuitem', { name: /As a note/ }).click();
    await expect(meis).toHaveCount(0);
    await expect(page.getByText('Nothing needs your attention')).toBeVisible();
    // The signature block carries no "For <company>" line — only the signatory.
    const invoicePrint = page.frameLocator('iframe[title="Print preview"]');
    await expect(invoicePrint.getByText('Signature & Date')).toBeVisible();
    await expect(invoicePrint.getByText(/^\s*For\b/)).toHaveCount(0);
    // The letterhead is the logo and the name; the Exporter box carries the address, GSTIN and IEC.
    await expect(invoicePrint.locator('.doc-head img')).toBeVisible();
    await expect(invoicePrint.locator('.doc-head .co-sub')).toHaveCount(0);

    // The packing list: renamed; a label the file does not have goes, a line it left out
    // comes in as a field with its value — and the preview prints it at once.
    await page.getByRole('tab', { name: /Packing List/ }).click();
    await page.getByRole('textbox', { name: 'Name of the packing list template' }).fill(PL_NAME);
    await attentionItem(page, '“Shipping Mark Ref” is not in your file').getByRole('button', { name: 'Remove' }).click();
    // The left-out line sits at row 60: "Show in file" scrolls the sheet to it.
    await attentionItem(page, 'Licence no Client:').getByRole('button', { name: 'Show in file' }).click();
    await expect(page.locator('td[data-cell="59:0"]')).toBeInViewport();
    await page.keyboard.press('Escape');
    await attentionItem(page, 'Licence no Client:').getByRole('button', { name: /Add to template/ }).click();
    await page.getByRole('menuitem', { name: /As a field/ }).click();
    await fillWithFixedText(page, 'Licence no Client', 'LIC-1234');
    await expect(page.getByText('Nothing needs your attention')).toBeVisible();
    await expect(page.frameLocator('iframe[title="Print preview"]').getByText('LIC-1234')).toBeVisible();
    // The preview is the whole page — the screen scrolls, not a box inside it. Column
    // cells are centred; header boxes stay left-aligned with label and value on one line.
    const printFrame = page.locator('iframe[title="Print preview"]');
    expect(await printFrame.evaluate((f) => f.contentDocument.body.scrollHeight <= f.clientHeight + 1)).toBe(true);
    const printed = page.frameLocator('iframe[title="Print preview"]');
    await expect(printed.locator('table.cols td.n').first()).toHaveCSS('text-align', 'center');
    await expect(printed.locator('table.hdr td').first()).not.toHaveCSS('text-align', 'center');
    await expect(printed.locator('table.hdr span.lbl', { hasText: 'Licence no Client:' })).toBeVisible();
    await expect(printed.locator('.doc-head img')).toBeVisible();
    // "Template only" blanks the document's own values (their space kept); fixed text and
    // the exporter stay. The document's reference is data; the licence text was fixed above.
    await page.getByText('Template only').first().click();
    await expect(printed.locator('.doc-head .ref')).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    await expect(printed.locator('span.val', { hasText: 'LIC-1234' })).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    await expect(printed.locator('.doc-head .co')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    await page.getByText('Sample values').first().click();
    await expect(printed.locator('.doc-head .ref')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');

    // "Edit layout in detail" sits with the preview (not in the page header); the editor
    // opens beside a live preview that follows each change — the printed title, and the font.
    await expect(page.getByRole('button', { name: 'Edit layout in detail' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Edit layout in detail' }).click();
    const workbench = page.locator('.ant-drawer-open').filter({ hasText: 'Edit layout in detail —' });
    const live = workbench.frameLocator('iframe[title="Print preview"]');
    // The mouse wheel zooms the preview rather than scrolling it.
    const zoomLabel = workbench.getByText(/^\d+%$/);
    await expect(zoomLabel).toBeVisible();
    const fitted = await zoomLabel.textContent();
    await workbench.locator('iframe[title="Print preview"]').locator('xpath=following-sibling::div[1]').hover();
    await page.mouse.wheel(0, -400);
    await expect(zoomLabel).not.toHaveText(fitted);
    // The editor alone, then back beside the preview.
    await workbench.getByText('Editor only').click();
    await expect(workbench.locator('iframe[title="Print preview"]')).toHaveCount(0);
    await workbench.getByText('Editor + preview').click();
    await workbench.locator('input[name="titleText"]').fill('PACKING LIST PRENATAL');
    await expect(live.getByText('PACKING LIST PRENATAL')).toBeVisible();
    // Orientation and paper reshape the page at once: A4 portrait is 794px wide, A3 portrait 1123px.
    const livePage = workbench.locator('iframe[title="Print preview"]');
    await pickOption(page, workbench.locator('.ant-select').filter({ hasText: 'Landscape' }), 'Portrait');
    await expect(livePage).toHaveCSS('width', '794px');
    await pickOption(page, workbench.locator('.ant-select').filter({ hasText: 'A4' }), 'A3');
    await expect(livePage).toHaveCSS('width', '1123px');
    await workbench.getByRole('tab', { name: 'Rules & formatting' }).click();
    // The font list is long (the dropdown renders only what is in view), so type to find one.
    await workbench.locator('.ant-select').filter({ hasText: 'Arial' }).click();
    await page.keyboard.type('Georgia');
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: 'Georgia' }).first().click();
    await expect(live.locator('body')).toHaveCSS('font-family', /Georgia/);
    // Each kind of text has its own size: the small labels are set to 9pt (12px on screen).
    await workbench.locator('input[name="textSize-label"]').fill('9');
    await expect(live.locator('.hdr .lbl').first()).toHaveCSS('font-size', '12px');
    await workbench.getByRole('button', { name: 'Done' }).click();
    // The closing panel's own "Bigger view" is gone once only the page's is left.
    await expect(page.getByRole('button', { name: 'Bigger view' })).toHaveCount(1);

    // "Bigger view" floats the page over the blurred screen, not in a side drawer.
    await page.getByRole('button', { name: 'Bigger view' }).click();
    const overlay = page.getByRole('dialog').filter({ has: page.locator('iframe[title="Template preview"]') });
    await expect(overlay.frameLocator('iframe[title="Template preview"]').getByText('PACKING LIST PRENATAL')).toBeVisible();
    await expect(page.locator('.ant-modal-mask-blur')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);

    // A file holding two documents can leave one out; the save follows.
    await page.getByRole('button', { name: "Don't create this packing list template" }).click();
    await expect(page.getByRole('button', { name: 'Save as draft' })).toBeVisible();
    await page.getByRole('button', { name: 'Create it after all' }).click();

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
    await expect(page.getByRole('button', { name: 'Copy JSON' })).toHaveCount(0);

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

  test('"New buyer template" for a buyer who has templates asks, then starts a new version', async ({ page }) => {
    await goTo(page, LIST);
    await page.getByRole('button', { name: 'New buyer template' }).click();
    const dialog = page.getByRole('dialog', { name: 'New buyer template' });
    await pickOption(page, dialog.locator('.ant-select'), 'JOMO BV');
    await dialog.getByRole('button', { name: 'Next' }).click();

    await expect(dialog.getByText(/JOMO BV already has \d+ templates/)).toBeVisible();
    await pickOption(page, dialog.locator('.ant-select'), PL_NAME);
    await dialog.getByRole('button', { name: 'Create new version' }).click();
    await expect(page).toHaveURL(/\/export-docs\/templates\/edit\/\d+/);
    await expect(page.getByText(/v3$/).first()).toBeVisible();
  });

  test('"New buyer template" for a buyer with none asks only how to make it', async ({ page }) => {
    await goTo(page, LIST);
    await page.getByRole('button', { name: 'New buyer template' }).click();
    const dialog = page.getByRole('dialog', { name: 'New buyer template' });
    await pickOption(page, dialog.locator('.ant-select'), 'Target Corporation');
    await dialog.getByRole('button', { name: 'Next' }).click();

    await expect(dialog.getByText('How do you want to create the template for Target Corporation?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Upload the document' }).click();
    // The upload opens with that buyer already chosen.
    const upload = page.getByRole('dialog', { name: "Upload a buyer's document" });
    await expect(upload.getByText('Target Corporation')).toBeVisible();
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
