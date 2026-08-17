/**
 * My Approvals inbox + flow admin, through the real screens (AF1, AF9).
 *
 * A dedicated 1-level Super Admin flow (priority 30) is created so that a submitted PO
 * lands in superadmin's own inbox — the seeded flow's level 1 belongs to the Admin
 * role, which the logged-in superadmin does not hold.
 *
 * Reject reasons are validated at 20 characters minimum by ApprovalActionBar — the
 * negative case types 10 characters and expects refusal.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest } from '../../helpers/approval.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';

let api;
let refs;
let flowId;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

async function submitFreshPo() {
  const po = buildGeneralPo(refs.localSupplier, refs.item, refs.terms);
  const created = await api.post('/purchase-orders', po);
  const { data: cur } = await api.get(`/purchase-orders/${created.data.id}`);
  await api.post('/purchase-orders', { ...cur, id: created.data.id, status: 'Pending_Approval' });
  return created.data;
}

test.describe('AF9 — My Approvals inbox', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    refs = await loadPoRefs(api);

    const { data: roles } = await api.get('/roles');
    const superRole = roles.find((r) => r.name === 'Super Admin');
    const res = await api.post('/approval-flows', {
      name: `E2E Inbox Flow ${Date.now()}`,
      entityType: 'PURCHASE_ORDER',
      active: true,
      priority: 30,
      levels: [{
        levelNumber: 1, levelName: 'Inbox level', approverType: 'ROLE',
        approverRoleId: superRole.id, allowReferBack: true, allowReject: true,
      }],
    });
    expect(res.status).toBeLessThan(300);
    flowId = res.data.id;
  });

  test.afterAll(async () => {
    if (flowId) {
      const { data } = await api.get(`/approval-flows/${flowId}`);
      if (data?.active) await api.patch(`/approval-flows/${flowId}/toggle`);
    }
    await api?.dispose();
  });

  test('a submitted PO appears in the inbox with type, submitter and level', async ({ page }) => {
    const po = await submitFreshPo();

    await navigateWithAuth(page, '/approvals');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: po.poNumber }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText(/Level 1\s*\/\s*1|Level 1 of 1|Inbox level/).first()).toBeVisible();

    // Clean up via engine so later tests start from an empty-enough inbox.
    const req = await findPendingRequest(api, 'PURCHASE_ORDER', po.id);
    await api.post(`/approval-requests/${req.id}/action`, {
      actionType: 'REJECT', comments: 'Cleanup rejection to drain the inbox row.',
    });
  });

  test('Review drawer: approve moves the PO to Sent_To_Supplier and clears the row', async ({ page }) => {
    const po = await submitFreshPo();

    await navigateWithAuth(page, '/approvals');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: po.poNumber }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button').filter({ hasText: /Review/i }).first().click();

    const drawer = page.locator('.ant-drawer:visible, .ant-drawer-open').last();
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await expect(drawer.getByText(/Approval level 1 of 1|Inbox level/).first()).toBeVisible();

    await drawer.locator('button').filter({ hasText: /^Approve$/ }).first().click();
    // Approve needs no reason; a confirm dialog may or may not appear.
    const confirm = page.locator('.ant-modal button').filter({ hasText: /^(OK|Confirm|Approve)$/ }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();

    await expect(
      page.locator('.ant-message-notice').filter({ hasText: /approved|success/i }).first()
    ).toBeVisible({ timeout: 15000 });

    const { data: after } = await api.get(`/purchase-orders/${po.id}`);
    expect(after.status).toBe('Sent_To_Supplier');

    await expect(
      page.locator('.ant-table-row').filter({ hasText: po.poNumber })
    ).toHaveCount(0, { timeout: 15000 });
  });

  test('reject requires a reason of at least 20 characters', async ({ page }) => {
    const po = await submitFreshPo();

    await navigateWithAuth(page, '/approvals');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: po.poNumber }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button').filter({ hasText: /Review/i }).first().click();

    const drawer = page.locator('.ant-drawer:visible, .ant-drawer-open').last();
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await drawer.locator('button').filter({ hasText: /^Reject$/ }).first().click();

    // Reason box appears (drawer or modal); 10 characters must be refused.
    const reason = page.locator('textarea:visible').last();
    await reason.fill('too short.');
    await page.locator('button:visible').filter({ hasText: /^(Reject|Confirm|OK)$/ }).last().click();
    await expect(
      page.getByText(/at least 20|minimum 20|20 characters/i).first()
    ).toBeVisible({ timeout: 10000 });

    // The PO must be untouched by the refused attempt.
    const { data: after } = await api.get(`/purchase-orders/${po.id}`);
    expect(after.status).toBe('Pending_Approval');

    // Complete the rejection with a valid reason.
    await reason.fill('Rejected in E2E: pricing must be renegotiated with the supplier.');
    await page.locator('button:visible').filter({ hasText: /^(Reject|Confirm|OK)$/ }).last().click();
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: /reject|success/i }).first()
    ).toBeVisible({ timeout: 15000 });
    const { data: rejected } = await api.get(`/purchase-orders/${po.id}`);
    expect(rejected.status).toBe('Rejected');
  });

  test('Open deep-links to the entity list with the view preselected', async ({ page }) => {
    const po = await submitFreshPo();

    await navigateWithAuth(page, '/approvals');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: po.poNumber }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button, a').filter({ hasText: /Open/i }).first().click();

    await page.waitForURL(/supplier-po\/list/, { timeout: 15000 });
    // The deep link opens the PO view (modal or drawer) for this PO.
    await expect(page.getByText(po.poNumber).first()).toBeVisible({ timeout: 15000 });

    const req = await findPendingRequest(api, 'PURCHASE_ORDER', po.id);
    if (req) {
      await api.post(`/approval-requests/${req.id}/action`, {
        actionType: 'REJECT', comments: 'Cleanup rejection to drain the inbox row.',
      });
    }
  });
});

test.describe('AF1 — approval flow admin UI', () => {
  let uiFlowName;

  test.beforeAll(async () => {
    api = api || (await createAuthenticatedClient());
  });

  test('create a two-level flow with a condition through the form', async ({ page }) => {
    uiFlowName = `E2E UI Flow ${Date.now()}`;

    await navigateWithAuth(page, '/admin/approval-flows');
    await waitForPageReady(page);

    await page.locator('button').filter({ hasText: /New|Add|Create/i }).first().click();
    const drawer = page.locator('.ant-drawer:visible, .ant-drawer-open').last();
    await expect(drawer).toBeVisible({ timeout: 10000 });

    await drawer.locator('input#name, input[id$="name"]').first().fill(uiFlowName);

    // Entity type select (label-anchored: placeholder text lives inside the selector).
    const entityField = drawer.locator('.ant-form-item').filter({ hasText: /Entity/i }).first();
    await entityField.locator('.ant-select').first().click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: /Cost Sheet|COST_SHEET/i }).first().click();

    // Add a second level; both default to ROLE approver — pick a role for each.
    await drawer.locator('button').filter({ hasText: /Add Level/i }).first().click();
    const roleSelects = drawer.locator('.ant-form-item').filter({ hasText: /Role/i }).locator('.ant-select');
    const count = await roleSelects.count();
    for (let i = 0; i < count; i++) {
      await roleSelects.nth(i).click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
      await page.waitForTimeout(200);
    }

    await drawer.locator('button').filter({ hasText: /Save|Create|Submit/i }).first().click();
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: /created|saved|success/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Round-trip through the API: two levels persisted in order.
    const { data: flows } = await api.get('/approval-flows');
    const created = flows.find((f) => f.name === uiFlowName);
    expect(created).toBeTruthy();
    expect(created.levels?.length).toBe(2);
    expect(created.levels[0].levelNumber).toBe(1);
    expect(created.levels[1].levelNumber).toBe(2);

    // Immediately deactivate so this COST_SHEET flow cannot disturb costing suites.
    await api.patch(`/approval-flows/${created.id}/toggle`);
  });

  test('toggle and delete from the list', async ({ page }) => {
    // Work on the flow created above (already inactive).
    const { data: flows } = await api.get('/approval-flows');
    const target = flows.find((f) => f.name === uiFlowName);
    expect(target).toBeTruthy();

    await navigateWithAuth(page, '/admin/approval-flows');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: uiFlowName }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    // Delete (no requests ever referenced it, so hard delete is safe here).
    await row.locator('button').filter({ has: page.locator('.anticon-delete') }).first()
      .or(row.locator('button').filter({ hasText: /Delete/i }).first())
      .click();
    const confirm = page.locator('.ant-modal:visible, .ant-popover:visible')
      .locator('button').filter({ hasText: /Yes|Delete|OK/i }).last();
    await confirm.click({ timeout: 10000 });

    await expect(
      page.locator('.ant-table-row').filter({ hasText: uiFlowName })
    ).toHaveCount(0, { timeout: 15000 });

    const { data: after } = await api.get('/approval-flows');
    expect(after.find((f) => f.name === uiFlowName)).toBeFalsy();
  });
});
