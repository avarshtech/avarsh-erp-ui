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
    // The action bar always confirms through the ApprovalReasonDialog modal, whose
    // primary button carries the SAME label as the action — wait for it, don't race it.
    const confirmDialog = page.locator('.ant-modal:visible').last();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    await confirmDialog.locator('button').filter({ hasText: /Approve/ }).last().click();

    // Assert on the OUTCOMES (entity state + inbox row), not on toast wording.
    await expect
      .poll(async () => (await api.get(`/purchase-orders/${po.id}`)).data.status, { timeout: 15000 })
      .toBe('Sent_To_Supplier');

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

    // The ApprovalReasonDialog enforces the 20-character minimum by DISABLING its
    // confirm button (with a tooltip), not by an error message.
    const confirmDialog = page.locator('.ant-modal:visible').last();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    const reason = confirmDialog.locator('textarea').first();
    const rejectBtn = confirmDialog.locator('button').filter({ hasText: /Reject/ }).last();

    await reason.fill('too short.');
    await expect(rejectBtn, '10-char reason must keep Reject disabled').toBeDisabled();

    // The PO must be untouched while the dialog blocks.
    const { data: after } = await api.get(`/purchase-orders/${po.id}`);
    expect(after.status).toBe('Pending_Approval');

    // Complete the rejection with a valid reason.
    await reason.fill('Rejected in E2E: pricing must be renegotiated with the supplier.');
    await expect(rejectBtn).toBeEnabled();
    await rejectBtn.click();
    await expect
      .poll(async () => (await api.get(`/purchase-orders/${po.id}`)).data.status, { timeout: 15000 })
      .toBe('Rejected');
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

  test('flow admin surface: list renders, form drawer opens with level controls', async ({ page }) => {
    // The flow CRUD contract itself is proven by the API suite (admin/approval-flows)
    // and every engine spec creates flows through it. Here we assert the ADMIN UI
    // surfaces: the list of flows and the authoring drawer with its level controls.
    await navigateWithAuth(page, '/admin/approval-flows');
    await waitForPageReady(page);

    // Flows render in the list (campaign-created flows may push the seeded one off
    // page 1 — row presence is the invariant, not any particular name).
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });

    // The create button is icon-only (plus).
    await page.locator('button').filter({ has: page.locator('.anticon-plus') }).first().click();
    const drawer = page.locator('.ant-drawer:visible, .ant-drawer-open').last();
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Core authoring controls exist: name, entity type, and the level editor.
    await expect(drawer.locator('input').first()).toBeVisible();
    await expect(drawer.locator('.ant-select').first()).toBeVisible();
    await expect(drawer.locator('button').filter({ hasText: /Add Approval Level/i }).first()).toBeVisible();

    await drawer.locator('.ant-drawer-close, button[aria-label="Close"]').first().click().catch(() => {});
  });
});
