/**
 * A sample request's whole working life, driven entirely through the screens.
 *
 * Raised from the seeded SAMPLE order's BOM, saved as a draft, submitted for a
 * real SRQ number, then put into production by two separate material issues —
 * fabric picked roll by roll (with a split, so a remnant stays in stock) and
 * trims counted out by quantity. Cancelling one of them must NOT undo
 * production: the request only falls back to Submitted when the last completed
 * issue is gone. That last rule is the one the module gets wrong most easily,
 * and it is the reason both documents are cancelled here rather than one.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import {
  SEED_ORDER_NO, goTo, settle, pickOption, selectFor, inputFor, fillDate,
  confirmModal, expectToast, tableRows, button,
} from './helpers.js';

const iso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Carried between the tests in this file — they are one story, in order. */
const state = { srNo: null, fabricIssueNo: null, trimsIssueNo: null };

/** Open the request's detail dialog off the list and wait for it to paint. */
async function openSr(page, srNo) {
  await goTo(page, '/sample-requests/list');
  await page.getByPlaceholder('Search SR No or Order No...').fill(srNo);
  await settle(page, 1200);
  await page.locator('.ant-table-row', { hasText: srNo }).first().click();
  await expect(page.locator('.ant-modal-wrap:visible').getByText(srNo).first())
    .toBeVisible({ timeout: 20000 });
}

/**
 * The status badge the detail dialog's hero shows. First tag on purpose: the
 * status steps below it name every status in the flow, so anything wider would
 * match "Submitted" on a request that is still a draft.
 */
async function srStatus(page) {
  return page.locator('.ant-modal-wrap:visible .ant-tag').first().innerText();
}

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests — draft to production and back', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('a request is raised from the seeded sample order BOM and saved as a draft', async ({ page }) => {
    await goTo(page, '/sample-requests/new');

    // The bare entry opens on the BOM picker — any BOM, sample or bulk.
    const picker = page.locator('.ant-select').first();
    await picker.click();
    await page.keyboard.type(SEED_ORDER_NO);
    await settle(page, 1200);
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: SEED_ORDER_NO }).first().click();

    // Header comes back materialised from the server, not assembled here.
    await expect(page.getByText('B · Sample Details')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText('Next PLC').first()).toBeVisible();

    await pickOption(page, selectFor(page, 'Sample Type'), 'Proto');
    await inputFor(page, 'Sample Quantity').fill('2');
    await fillDate(page, 'Sample In-Hand Date', iso(3));
    await fillDate(page, 'Dispatch Deadline', iso(10));
    await fillDate(page, 'Buyer Approval Deadline', iso(20));

    // Sizes default to the order's own run (S/M/L from the seed), which is
    // what the sample quantity column multiplies by.
    await expect(page.getByText('D · Materials').first()).toBeVisible();

    await button(page, /^Save as Draft$/).click();
    await expectToast(page, /saved as draft/i);

    await settle(page, 1500);
    const rows = await tableRows(page);
    const draftRow = rows.find((r) => r.includes('SRQ/'));
    expect(draftRow, `no SRQ row in the list:\n${rows.join('\n')}`).toBeTruthy();
    state.srNo = draftRow.match(/SRQ\/[\w-]+\/\d+/)[0];
    expect(state.srNo).toMatch(/^SRQ\//);
  });

  test('submitting the draft moves it to Submitted', async ({ page }) => {
    await openSr(page, state.srNo);
    expect(await srStatus(page)).toMatch(/Draft/i);

    await button(page.locator('.ant-modal-wrap:visible'), /^Submit$/).click();
    await confirmModal(page, /^OK$/);
    await expectToast(page, /Submitted/i);

    await openSr(page, state.srNo);
    expect(await srStatus(page)).toMatch(/Submitted/i);
  });

  test('a fabric issue splits a roll and starts production', async ({ page }) => {
    await goTo(page, '/inventory/issue/sample/fabric/new');

    await pickOption(page, selectFor(page, 'Sample Request'), state.srNo);
    await pickOption(page, selectFor(page, 'Fabric Line'), 'FAB-SJ-001');
    await inputFor(page, 'Received By').fill('E2E Sampling Room');
    await settle(page, 900);

    // Split the first offered roll — the seed's SMP/0001-earmarked one, which
    // the server orders first. The remnant keeps the original roll number and
    // stays in stock; the "-A" sub-roll is what goes out on this document.
    const rollTable = page.locator('.ant-table').last();
    // .ant-table-row, not tr: a scrollable AntD table puts a hidden measure row
    // first in the tbody, and that one has no Split button.
    const firstRoll = rollTable.locator('.ant-table-row').first();
    const rollNumber = (await firstRoll.locator('td').first().innerText()).trim();
    await button(firstRoll, /^Split$/).click();

    const popover = page.locator('.ant-popover:not(.ant-popover-hidden)').last();
    await popover.locator('input').first().fill('2');
    await button(popover, /^Split$/).click();
    await settle(page, 500);

    await expect(rollTable.getByText(`${rollNumber}-A`).first(),
      'the split must produce an -A sub-roll').toBeVisible();
    await expect(page.getByText('Rolls Selected').first()).toBeVisible();

    await button(page, /^Issue$/).click();
    await expectToast(page, /SRI\//);

    await settle(page, 1500);
    const rows = await tableRows(page);
    const issued = rows.find((r) => r.includes('SRI/') && r.includes(state.srNo));
    expect(issued, `fabric issue not in the register:\n${rows.join('\n')}`).toBeTruthy();
    state.fabricIssueNo = issued.match(/SRI\/[\w-]+\/\d+/)[0];

    await openSr(page, state.srNo);
    expect(await srStatus(page), 'the first completed issue starts production')
      .toMatch(/In Production/i);
  });

  test('a trims issue is a second document against the same request', async ({ page }) => {
    await goTo(page, '/inventory/issue/sample/trims/new');

    await pickOption(page, selectFor(page, 'Sample Request'), state.srNo);
    await inputFor(page, 'Received By').fill('E2E Sampling Room');
    await settle(page, 700);

    // Every trim line is offered; issuing the button line alone is the normal
    // partial case, and it is the one the seed spreads over two FIFO lots.
    const itemTable = page.locator('.ant-table').last();
    const buttonRow = itemTable.locator('.ant-table-row', { hasText: 'TRM-BTN-001' }).first();
    const demand = (await buttonRow.locator('td').nth(5).innerText()).trim();
    await buttonRow.locator('input').first().fill(demand.replace(/,/g, ''));

    await button(page, /^Issue$/).click();
    await expectToast(page, /SRI\//);

    await settle(page, 1500);
    // The register opens on the Trims side after this form.
    const rows = await tableRows(page);
    const issued = rows.find((r) => r.includes('SRI/') && r.includes(state.srNo));
    expect(issued, `trims issue not in the register:\n${rows.join('\n')}`).toBeTruthy();
    state.trimsIssueNo = issued.match(/SRI\/[\w-]+\/\d+/)[0];
    expect(state.trimsIssueNo).not.toBe(state.fabricIssueNo);

    await openSr(page, state.srNo);
    expect(await srStatus(page)).toMatch(/In Production/i);
  });

  test('cancelling one issue leaves the request In Production; cancelling the last returns it to Submitted', async ({ page }) => {
    await goTo(page, '/inventory/issue?segment=SampleRequest&issueType=FABRIC');
    await cancelIssue(page, state.fabricIssueNo);

    await openSr(page, state.srNo);
    expect(await srStatus(page), 'the surviving trims issue keeps production open')
      .toMatch(/In Production/i);

    await goTo(page, '/inventory/issue?segment=SampleRequest&issueType=ACCESSORY');
    await cancelIssue(page, state.trimsIssueNo);

    await openSr(page, state.srNo);
    expect(await srStatus(page), 'no completed issue left — production is undone')
      .toMatch(/Submitted/i);
  });
});

/** Cancel one document from the register, reason and all. */
async function cancelIssue(page, issueNumber) {
  const row = page.locator('[role="tabpanel"]:visible .ant-table-row', { hasText: issueNumber }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  // The cancel action is the last button on the row.
  await row.locator('button').last().click();

  const modal = page.locator('.ant-modal-wrap:visible').last();
  await expect(modal.getByText(`Cancel ${issueNumber}`)).toBeVisible({ timeout: 15000 });
  await modal.locator('textarea').fill('Cancelled by the e2e suite to prove the stock restore and the status revert');
  await button(modal, /^Cancel Issue$/).click();
  await expectToast(page, /cancelled — stock restored/i);
  await settle(page, 1200);
}
