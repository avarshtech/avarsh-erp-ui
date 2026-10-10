/**
 * Carton-sticker buyer templates: uploading one and checking it, and printing with one
 * (plan §5.4, §5.5, §9).
 *
 * The e2e stack has no AI key, so the upload answers POST .../extract from a fixture
 * modelled on Van Gennip's "VGT" sticker — a POST, which the service worker never
 * intercepts — and saves and publishes through the real API. The boundary spec goes to
 * the real API with no mock: a file chosen as "Carton sticker" is checked on its own
 * words before any AI is asked, so an invoice or a packing list is refused there, while a
 * genuine sticker passes and only then meets the missing AI key.
 *
 * Every template a spec creates gets a unique code, so the specs can run again on the
 * same stack. The e2e seed already gives JOMO BV two ACTIVE sticker templates, AMG and
 * SCA; the print workspace spec picks them by name, because the upload spec adds another
 * ACTIVE JOMO sticker on every run.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import {
  attentionItem, familyCard, fixtureForRun, textPdf, uploadForReading,
} from '../../helpers/export-templates.js';
import { goTo } from '../sample-requests/helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(path.join(here, '../../fixtures/ai/template-extraction-sticker.json'), 'utf8'));
const run = Date.now().toString(36).toUpperCase();

const STICKER = 'Carton sticker';
const ONE_EXAMPLE = 'One example of each sticker layout is enough — not the whole print run.';
/** The words of a VGT carton sticker, as its PDF's text layer carries them. */
const VGT_LINES = ['Article Number : M60980-37GOY', 'Size : 98', 'Quantity : 30', 'Carton Number :', 'Weight of Carton : 7.000 KGS'];
/** The seeded JOMO BV sticker layouts, by the words of their names. */
const AMG = 'Carton Sticker (AMG main and side)';
const SCA = 'Carton Sticker (colon list with EAN)';

/**
 * Picks a layout in the sticker workspace by name. The list grows with every run of the
 * upload spec, and the dropdown renders only what is in view, so the name is typed.
 */
const pickLayout = async (page, name) => {
  await page.locator('.ant-select').filter({ has: page.locator('#sticker-layout') }).click();
  await page.keyboard.type(name);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: name }).first().click();
};

test.describe('Carton-sticker templates', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('an uploaded carton sticker is checked, its batch number asked when printing, and published', async ({ page }) => {
    const fixture = fixtureForRun(FIXTURE, run);
    const { suggestedCode: code, suggestedName: name } = fixture.documents[0];
    let hint = null;
    await page.route('**/export-docs/templates/extract', (route) => {
      hint = /name="docTypeHint"\r\n\r\n(\w+)/.exec(route.request().postData() || '')?.[1] ?? null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
    });
    // The e2e stack has no working file storage; the source file is stored first, so it is answered here.
    await page.route('**/files/upload', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ fileId: '00000000-0000-4000-8000-00000000e2e2', originalFilename: 'vgt-carton-sticker.pdf' }),
    }));
    await uploadForReading(page, textPdf('vgt-carton-sticker.pdf', VGT_LINES), { contains: STICKER });

    await expect(page).toHaveURL(/\/export-docs\/templates\/import/);
    expect(hint).toBe('STICKER');
    // One document: the carton sticker, one face of nine lines.
    await expect(page.getByText(/We found 1 document in vgt-carton-sticker\.pdf/)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /Carton Sticker/ })).toBeVisible();
    await expect(page.getByText(/1 face · 9 lines/)).toBeVisible();
    await expect(page.getByText('Checked first: this file was read as “carton sticker”.', { exact: false })).toBeVisible();

    // The batch number changes with every order: it is asked once per print run.
    const batch = attentionItem(page, '“BATCH #” — nothing fills it yet');
    await expect(batch).toContainText('Your file shows “261505-SR” here.');
    await expect(batch.getByRole('button', { name: 'Leave blank (hand-written)' })).toBeVisible();
    await batch.getByRole('button', { name: 'Ask when printing' }).click();
    await expect(batch).toHaveCount(0);
    await expect(page.getByText('Nothing needs your attention')).toBeVisible();
    // The preview shows where the answer will print.
    await expect(page.frameLocator('iframe[title="Print preview"]').getByText('‹BATCH #›').first()).toBeVisible();

    await page.getByRole('button', { name: 'Save & publish' }).click();
    await expect(page).toHaveURL(/\/export-docs\/templates\/list\?buyer=buyer:\d+&highlight=/);
    await expect(page.getByRole('heading', { name: 'JOMO BV', level: 4 })).toBeVisible();
    const card = familyCard(page.getByRole('group', { name: 'Carton Sticker templates' }), code);
    await expect(card).toBeVisible();
    await expect(card.getByText(name)).toBeVisible();
    await expect(card.getByText('Just saved')).toBeVisible();
    await expect(card.locator('.ant-tag').filter({ hasText: /^active$/i })).toBeVisible();
  });

  test('a file chosen as a carton sticker is checked on its own words before it is read', async ({ page }) => {
    // An invoice is refused before any AI is asked — and can still be built by hand, as a blank sticker.
    const invoice = textPdf('vgt-invoice.pdf', ['COMMERCIAL INVOICE', 'Description Qty Rate Amount', 'FOB USD 1250.00']);
    let dialog = await uploadForReading(page, invoice, { contains: STICKER });
    await expect(dialog.getByText('This file cannot become a template')).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByText(/looks like an invoice/)).toBeVisible();
    await expect(dialog.getByText(ONE_EXAMPLE)).toBeVisible();
    await dialog.getByRole('button', { name: 'Build it by hand' }).click();
    const create = page.getByRole('dialog', { name: 'New document template' });
    await expect(create).toBeVisible();
    await expect(create.locator('.ant-segmented-item-selected')).toHaveText('Start blank');
    await expect(create.getByText('Carton Sticker', { exact: true })).toBeVisible();
    await expect(create.locator('input[name="newTemplateCode"]')).toHaveValue('JOMO-STK');
    await create.getByRole('button', { name: 'Cancel' }).click();
    await expect(create).toHaveCount(0);

    // A titled packing list is refused too.
    const packingList = textPdf('jomo-packing-list.pdf', ['PACKING LIST', 'CTN NO   COLOUR   QTY   NET WT   GROSS WT']);
    dialog = await uploadForReading(page, packingList, { contains: STICKER });
    await expect(dialog.getByText(/looks like a packing list/)).toBeVisible({ timeout: 30000 });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    // A genuine sticker passes the check, and only then meets the missing AI key.
    dialog = await uploadForReading(page, textPdf('vgt-carton-sticker.pdf', VGT_LINES), { contains: STICKER });
    await expect(dialog.getByText('AI reading is not available here')).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByRole('button', { name: 'Build it by hand' })).toBeVisible();
  });

  test('stickers print with the layout picked by name, its batch number asked once and kept on the run', async ({ page }) => {
    // Packing lists are still the browser mock: one for JOMO BV's packing entry 1 (cartons
    // 1–61), raised through the same service the screens call. No shipment is named, so
    // this holds before and after the shipments move to the API.
    await goTo(page, '/export-docs/stickers');
    const plId = await page.evaluate(async () => {
      const svc = await import('/src/services/expdoc/expDocService.js');
      return (await svc.createPackingList({ packingEntryIds: [1] })).id;
    });
    await goTo(page, `/export-docs/stickers/${plId}`);

    // JOMO BV has two layouts of its own, so nothing prints until one is picked.
    await expect(page.getByText('Pick the sticker layout', { exact: true })).toBeVisible();
    const generate = page.getByRole('button', { name: /Generate & print/ });
    await expect(generate).toBeDisabled();

    // AMG: a main and a side mark, the size grid with its totals, the carton as "n OF N".
    const sheet = page.frameLocator('iframe[title="Sticker sheet preview"]').locator('body');
    await pickLayout(page, AMG);
    await expect(sheet).toContainText('MAIN MARK');
    await expect(sheet).toContainText('SIDE MARK');
    await expect(sheet).toContainText('TOTAL');
    await expect(sheet).toContainText('1 OF 61');

    // SCA brings its own face and asks its batch number once for the run (focus 5).
    await pickLayout(page, SCA);
    const batch = page.getByLabel('BATCH #');
    await expect(batch).toBeVisible();
    await expect(sheet).toContainText('Weight of Carton');
    await expect(sheet).not.toContainText('MAIN MARK');
    // It prints EANs, which cartons 48–61 do not have: barcodes start off, and say so (focus 6).
    await expect(page.getByRole('switch', { name: 'Print barcodes' })).not.toBeChecked();
    const noEan = page.getByRole('alert').filter({ hasText: 'This template prints EAN barcodes, but 14 carton(s) have no EAN' });
    await expect(noEan).toBeVisible();
    await expect(noEan).toContainText('Cartons without an EAN: 48–61.');
    await expect(generate).toBeDisabled();

    // The answer prints after the label's one colon, never "::" (focus 3).
    const value = `E2E-${run}`;
    await batch.fill(value);
    await expect(sheet).toContainText(new RegExp(`BATCH #\\s*:\\s*${value}`));
    await expect(sheet).not.toContainText('::');

    // A draft packing list prints only with the override and a reason; the labels open in a print window.
    await expect(generate).toBeEnabled();
    await generate.click();
    const override = page.getByRole('dialog', { name: 'Print from a draft packing list?' });
    await override.locator('textarea').fill('E2E: the cartons are labelled before the list is final.');
    const printWindow = page.waitForEvent('popup');
    await override.getByRole('button', { name: 'Print draft labels' }).click();
    await (await printWindow).close();

    // The run is recorded with the value it printed.
    const runs = page.locator('.ant-card').filter({ has: page.getByText('Printed runs', { exact: true }) });
    await expect(runs).toContainText(`BATCH #: ${value}`);
    await expect(runs).toContainText('From draft');
  });
});
