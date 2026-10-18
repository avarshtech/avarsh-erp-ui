/**
 * Production flow 02 — the floor masters the later stages need and the e2e seed does not ship: a sewing
 * line of HR unit 1 (where the flow's Cutting PO and Work Order run), created on the Production Masters
 * screen, and through the API (HR has its own specs) an active shift and an employee to sign the
 * measurement report.
 */
import { test, expect } from '../../fixtures.js';
import { FLOW_LINE_PREFIX, ensureFlowStaff } from '../../helpers/production-flow-seed.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { chooseLabelled, labelled, responseOf, successToast } from './helpers.js';

const STAMP = Date.now().toString().slice(-6);

test.describe('Production flow — floor masters', () => {
  test('a sewing line of unit 1 is created on the Production Masters screen', async ({ api, authedPage, consoleGuard }) => {
    const name = `${FLOW_LINE_PREFIX} ${STAMP}`;
    await authedPage.goto('/production/masters');
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: /Add Line/ }).click();
    const lineName = labelled(authedPage, 'Line Name').locator('input');
    await expect(lineName).toBeVisible();
    await lineName.fill(name);
    await chooseLabelled(authedPage, 'Unit (Unit)', 'Unit 1');
    await labelled(authedPage, 'Operator Capacity').locator('input').fill('20');

    const saved = await responseOf(authedPage, 'POST', /\/production-lines$/,
      () => authedPage.getByRole('button', { name: /Save/ }).last().click());
    await successToast(authedPage, /Line created/);
    expect(saved.name).toBe(name);
    expect(saved.unitId).toBe(1);
    expect(saved.lineType).toBe('SEWING');

    // The floor screens list it for unit 1
    const { data: lines } = await api.get('/production-lines', { unitId: 1 });
    expect(lines.map((l) => l.name)).toContain(name);
    await expect(authedPage.locator('.ant-table-row', { hasText: name })).toBeVisible();
    expect(consoleGuard).toEqual([]);
  });

  test('the floor has an active shift and an employee of unit 1', async ({ api }) => {
    const { shift, employee } = await ensureFlowStaff(api, { stamp: STAMP });
    expect(shift.id).toBeTruthy();
    expect(employee.status).toBe('ACTIVE');
    const { data: active } = await api.get('/hr/shifts/active');
    expect(active.map((s) => s.id)).toContain(shift.id);
  });
});
