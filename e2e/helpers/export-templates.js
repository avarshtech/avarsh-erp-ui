/**
 * Shared by the buyer-template specs (the export-docs project): the template register, the
 * upload dialog, the review's "Needs your attention" list, a PDF with a real text layer,
 * and AI fixtures made unique per run, so the specs can run again on the same stack.
 */
import { expect } from '@playwright/test';
import { goTo } from '../specs/sample-requests/helpers.js';

export const TEMPLATE_LIST = '/export-docs/templates/list';

/** An extraction fixture, with codes and names no earlier run has used. */
export const fixtureForRun = (fixture, run) => {
  const result = JSON.parse(JSON.stringify(fixture));
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
export const textPdf = (name, lines) => {
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

/** Picks a buyer on the register's rail and waits for their panel. */
export const openBuyer = async (page, name) => {
  await page.getByRole('button', { name: `${name} templates` }).click();
  await expect(page.getByRole('heading', { name, level: 4 })).toBeVisible();
};

/**
 * Opens the upload dialog for a buyer, says what the file contains (the dialog's own
 * default otherwise), puts the file in and asks for the reading. Returns the dialog.
 *
 * "The file contains" is a radio group. antd draws each radio as a 0 × 0 input inside its
 * label, so the option is found by its role and name and its label takes the click.
 */
export const uploadForReading = async (page, file, { buyer = 'JOMO BV', contains } = {}) => {
  await goTo(page, TEMPLATE_LIST);
  await openBuyer(page, buyer);
  await page.getByRole('button', { name: /Upload buyer document/ }).click();
  const dialog = page.getByRole('dialog', { name: "Upload a buyer's document" });
  if (contains) {
    const option = dialog.getByRole('radiogroup', { name: 'The file contains' }).getByRole('radio', { name: contains, exact: true });
    await option.locator('xpath=..').click();
    await expect(option).toBeChecked();
  }
  await dialog.locator('input[type=file]').setInputFiles(file);
  await dialog.getByRole('button', { name: 'Read the document' }).click();
  return dialog;
};

/** One template family's card on the register, by its template code. */
export const familyCard = (scope, code) => scope.locator(`[data-template-code="${code}"]`);

/** The review's "Needs your attention" item whose text includes `text`. */
export const attentionItem = (page, text) => page.getByRole('list', { name: 'Needs your attention' })
  .getByRole('listitem').filter({ hasText: text });
