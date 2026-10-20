/**
 * PO — Order Mapping, against the real API.
 *
 * A General supplier PO is bought before the customer confirms. This screen records which
 * customer orders it ended up serving, per line and per quantity.
 *
 * Two rules get a regression guard of their own, because both were decided against what the
 * mock originally showed:
 *   - a Thread line IS mappable. The mock admitted only Fabric, Trims and Accessories, but
 *     in the real item master Thread is its own top-level category and Accessories means
 *     hangers and polybags. The eligible set is a server property.
 *   - a SAMPLE order is NOT a mapping target. The seed carries thirteen CONFIRMED sample
 *     orders, and a status-only filter would have offered every one of them.
 *
 * The suite never asserts a row count or a page position: the seed yields 29 mapping
 * candidates, so every case finds PO/0003 through the search box. State is driven by the
 * test rather than seeded, and reset before each case so no case depends on another.
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

/**
 * antMessageContains only waits and returns text, so it cannot fail a test on its own.
 * This asserts, which is the point: a toast that never arrives means the write did not
 * land, and a silent pass would hide exactly that.
 */
async function expectToast(page, text) {
  await expect(page.locator('.ant-message')).toContainText(text, { timeout: 10000 });
}

/** The house helper matches ok/yes/delete/confirm; this Popconfirm's button says Remove. */
async function confirmRemove(page) {
  const popconfirm = page.locator('.ant-popconfirm').last();
  await popconfirm.waitFor({ state: 'visible', timeout: 5000 });
  await popconfirm.getByRole('button', { name: /^Remove$/ }).click();
  await popconfirm.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

const PO_NUMBER = 'PO/0003';
const BULK_ORDER = 'ORD/0002';
// Also confirmed and bulk, and its BOM uses the SAME item in a different colour — which
// is what makes it the right negative for the variant-exact rule.
const OTHER_BULK_ORDER = 'ORD/0003';
const SAMPLE_ORDER = 'SMP/0001';
const MAPPING = '/purchase-orders/order-mapping';

async function findPo(api) {
  const { data } = await api.get(MAPPING, { search: PO_NUMBER, size: '5' });
  return (data.content || []).find((r) => r.poNumber === PO_NUMBER) || null;
}

async function fabricLineAndOrder(api, poId) {
  const { data: detail } = await api.get(`${MAPPING}/${poId}`);
  const { data: orders } = await api.get(`${MAPPING}/orders`);
  return {
    detail,
    line: detail.lineItems.find((l) => l.itemCode === 'FAB-SJ-001'),
    order: orders.find((o) => o.orderNo === BULK_ORDER),
  };
}

/** Leaves PO/0003 unmapped and not stock-only. */
async function resetMappingState() {
  const api = await createAuthenticatedClient();
  try {
    const row = await findPo(api);
    if (!row) return null;
    const { data: detail } = await api.get(`${MAPPING}/${row.id}`);
    for (const line of detail.lineItems) {
      for (const alloc of line.allocations) {
        await api.delete(`${MAPPING}/${row.id}/allocations/${alloc.id}`);
      }
    }
    if (detail.stockOnly) {
      await api.put(`${MAPPING}/${row.id}/stock-only`, { stockOnly: false });
    }
    return row.id;
  } finally {
    await api.dispose();
  }
}

/** Open the workspace from the Supplier PO list and search down to PO/0003. */
async function openWorkspaceOnPo(page) {
  await goToListPage(page, '/purchase-orders/supplier-po/list');
  await antTableWaitForData(page);

  await page.getByRole('button', { name: /order mapping/i }).click();
  // The house convention is .ant-drawer-open; there is no .ant-drawer-content in this
  // Ant Design version. Two drawers are open at once once a PO is opened, so each is
  // identified by text only it carries.
  const drawer = page.locator('.ant-drawer-open').filter({ hasText: 'Order Mapping' }).first();
  await expect(drawer).toBeVisible({ timeout: 10000 });

  await drawer.getByPlaceholder(/search po, supplier, item or order/i).fill(PO_NUMBER);
  await expect(drawer.getByText(PO_NUMBER, { exact: true }).first()).toBeVisible({ timeout: 15000 });
  return drawer;
}

async function openPoDrawer(page) {
  const workspace = await openWorkspaceOnPo(page);
  await workspace.getByText(PO_NUMBER, { exact: true }).first().click();
  const drawer = page.locator('.ant-drawer-open').filter({ hasText: 'Mapping history' }).first();
  await expect(drawer).toBeVisible({ timeout: 15000 });
  return drawer;
}

/**
 * The inline "map N units to order X" form under a line. Scoping to it avoids two traps:
 * an icon Button's accessible name includes the icon ("link Map", not "Map"), and the
 * drawer holds one adder per open line.
 */
function firstAdder(drawer) {
  return drawer.locator('form.ant-form-inline').first();
}

function visibleDropdown(page) {
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
}

/**
 * Ant Design renders a Select's placeholder as a span, not a placeholder attribute, so
 * getByPlaceholder never matches one. The house antSelect helper clicks the .ant-select
 * wrapper, and so does this.
 */
async function openOrderPicker(page, scope) {
  await scope.locator('.ant-select').first().click();
  const dropdown = visibleDropdown(page);
  await dropdown.waitFor({ state: 'visible', timeout: 10000 });
  return dropdown;
}

async function pickOrder(page, scope, orderNo = BULK_ORDER) {
  const dropdown = await openOrderPicker(page, scope);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: orderNo }).first().click();
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  await resetMappingState();
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test.afterAll(async () => {
  await resetMappingState();
});

test.describe('PO — Order Mapping', () => {

  test('the workspace lists the PO as unmapped', async ({ page }) => {
    const workspace = await openWorkspaceOnPo(page);
    const row = workspace.locator('.ant-table-row', { hasText: PO_NUMBER }).first();

    await expect(row).toContainText('Unmapped');
    await expect(row).toContainText('Shahi Exports');
    await expect(row).toContainText('0 of 3 lines fully mapped');
  });

  test('the Thread line is offered for mapping', async ({ page }) => {
    // Regression guard for the widened category property: narrow it back to the mock's
    // Fabric/Trims/Accessories and this line vanishes, which would quietly hide a material
    // a garment actually consumes.
    const drawer = await openPoDrawer(page);

    // The codes also appear in every history line, so match the item cell exactly.
    await expect(drawer.getByText('FAB-SJ-001', { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText('TRM-BTN-001', { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText('THD-SW-001', { exact: true }).first()).toBeVisible();
  });

  test('the order picker offers bulk orders and never a sample order', async ({ page }) => {
    const drawer = await openPoDrawer(page);

    const dropdown = await openOrderPicker(page, drawer);
    await expect(dropdown.locator('.ant-select-item-option').filter({ hasText: BULK_ORDER }).first()).toBeVisible();
    await expect(dropdown.locator('.ant-select-item-option').filter({ hasText: SAMPLE_ORDER })).toHaveCount(0);
  });

  test('mapping part of a line, then removing it, returns the quantity to open', async ({ page }) => {
    const drawer = await openPoDrawer(page);

    const adder = firstAdder(drawer);
    await pickOrder(page, adder);
    await adder.locator('.ant-input-number-input').first().fill('200');
    await adder.locator('button[type="submit"]').first().click();

    await expectToast(page, 'Mapped to order');
    await expect(drawer.getByText(/Partially Mapped/i).first()).toBeVisible({ timeout: 10000 });
    // The trail accumulates across runs, so assert the entry exists rather than that it is unique.
    // The line is labelled by variant code alone — it already opens with the item code, so
    // naming both repeated it — and the variant is the purchasable identity, so the trail
    // still says which colour.
    await expect(drawer.getByText(/200 kg of FAB-SJ-001-NVY to ORD\/0002/).first()).toBeVisible();

    await drawer.locator('.ant-btn-dangerous').first().click();
    await confirmRemove(page);

    await expectToast(page, 'Mapping removed');
    await expect(drawer.getByText(/200 kg of FAB-SJ-001-NVY from ORD\/0002/).first()).toBeVisible();
  });

  test('over-mapping is refused with the server message', async ({ page }) => {
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { line, order } = await fabricLineAndOrder(api, row.id);

      const refused = await api.post(`${MAPPING}/${row.id}/allocations`, {
        poLineItemId: line.id, orderId: order.id, qty: 9999,
      });

      expect(refused.status).toBe(409);
      expect(refused.data.message).toContain('still unmapped');
    } finally {
      await api.dispose();
    }

    // The screen shows the balance it enforces, so the user is not guessing.
    const drawer = await openPoDrawer(page);
    await expect(drawer.getByText(/Open: 500\.000 kg/).first()).toBeVisible();
  });

  test('a sample order is refused as a mapping target', async () => {
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { line } = await fabricLineAndOrder(api, row.id);
      const { data: sample } = await api.get('/orders/by-order-no', { orderNo: SAMPLE_ORDER });

      const refused = await api.post(`${MAPPING}/${row.id}/allocations`, {
        poLineItemId: line.id, orderId: sample.id, qty: 10,
      });

      expect(refused.status).toBe(409);
      expect(refused.data.message).toContain('only bulk orders can receive purchase order stock');
    } finally {
      await api.dispose();
    }
  });

  test('mapping every open line in full marks the PO fully mapped', async ({ page }) => {
    // Replaces the old "map entire PO to one order" button, which was removed: under a
    // variant-exact rule sibling lines of one PO legitimately belong to different orders,
    // so the whole-PO shortcut cannot be defended. Each line is mapped to the order that
    // actually uses its variant instead.
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { data: detail } = await api.get(`${MAPPING}/${row.id}`);

      for (const line of detail.lineItems) {
        if (!(line.unmappedQty > 0)) continue;
        const { data: orders } = await api.get(`${MAPPING}/lines/${line.id}/orders`);
        if (orders.length === 0) continue; // no order uses this variant — covered below
        await api.post(`${MAPPING}/${row.id}/allocations`, {
          poLineItemId: line.id, orderId: orders[0].id, qty: line.unmappedQty,
        });
      }
    } finally {
      await api.dispose();
    }

    const drawer = await openPoDrawer(page);
    await expect(drawer.getByText(/Fully Mapped/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('an order whose BOM does not use the line variant is refused', async () => {
    // The whole point of the variant filter. PO/0003 buys navy single jersey, which only
    // ORD/0002 consumes; ORD/0003 uses the black variant of the same item, so matching on
    // the item alone would have accepted this.
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { line } = await fabricLineAndOrder(api, row.id);
      const { data: wrong } = await api.get('/orders/by-order-no', { orderNo: OTHER_BULK_ORDER });

      const refused = await api.post(`${MAPPING}/${row.id}/allocations`, {
        poLineItemId: line.id, orderId: wrong.id, qty: 10,
      });

      expect(refused.status).toBe(409);
      expect(refused.data.message).toContain('cannot be mapped to it');
    } finally {
      await api.dispose();
    }
  });

  test('the picker offers only the orders that use the line variant', async () => {
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { data: detail } = await api.get(`${MAPPING}/${row.id}`);

      const fabric = detail.lineItems.find((l) => l.itemCode === 'FAB-SJ-001');
      const { data: forFabric } = await api.get(`${MAPPING}/lines/${fabric.id}/orders`);
      expect(forFabric.map((o) => o.orderNo)).toEqual([BULK_ORDER]);

      // The unfiltered list is what the picker used to show, and it offers more than one
      // order for the same line — so this assertion cannot pass vacuously.
      const { data: unfiltered } = await api.get(`${MAPPING}/orders`);
      expect(unfiltered.length).toBeGreaterThan(forFabric.length);

      // The trims line buys a colour no BOM uses, so its picker is legitimately empty.
      const trims = detail.lineItems.find((l) => l.itemCode === 'TRM-BTN-001');
      const { data: forTrims } = await api.get(`${MAPPING}/lines/${trims.id}/orders`);
      expect(forTrims).toEqual([]);
    } finally {
      await api.dispose();
    }
  });

  test('Stock Only is refused while mappings exist, and accepted once they are gone', async ({ page }) => {
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { line, order } = await fabricLineAndOrder(api, row.id);
      await api.post(`${MAPPING}/${row.id}/allocations`, {
        poLineItemId: line.id, orderId: order.id, qty: 50,
      });

      const refused = await api.put(`${MAPPING}/${row.id}/stock-only`, {
        stockOnly: true, remark: 'year end lot',
      });
      expect(refused.status).toBe(409);
      expect(refused.data.message).toContain('remove them before marking it Stock Only');
    } finally {
      await api.dispose();
    }

    await resetMappingState();

    const drawer = await openPoDrawer(page);
    await drawer.getByRole('button', { name: /mark stock only/i }).click();
    const modal = page.locator('.ant-modal').filter({ hasText: /as stock only/i }).last();
    await modal.getByRole('textbox').fill('Year-end stock lot, held for development');
    await modal.getByRole('button', { name: /mark stock only/i }).click();

    await expectToast(page, 'marked as Stock Only');
    await expect(drawer.getByText(/deliberately not mapped to any order/i)).toBeVisible({ timeout: 10000 });
  });

  test('a mapped General PO carries its supplier delay through to the order', async ({ page }) => {
    // The reason this feature exists. PoOrderDelayService reads order_references, which the
    // PO form leaves null for every General PO, so before mapping fed it a General PO could
    // slip a month and no order noticed.
    const api = await createAuthenticatedClient();
    try {
      const row = await findPo(api);
      const { line, order } = await fabricLineAndOrder(api, row.id);

      // The API refuses a revision that matches the date already in force, and the e2e
      // database only resets when the API reboots — so push past whatever is there now
      // rather than assuming a clean PO.
      const { data: po } = await api.get(`/purchase-orders/${row.id}`);
      const current = new Date(po.revisedDeliveryDate || po.deliveryDate);
      current.setDate(current.getDate() + 20);
      const revised = await api.put(`/purchase-orders/${row.id}/revise-delivery-date`, {
        revisedDeliveryDate: current.toISOString().slice(0, 10),
        reason: 'supplier mill breakdown',
      });
      expect(revised.status).toBe(200);

      // beforeEach cleared every mapping, so nothing links this PO to the order yet and
      // the slip cannot have reached it. That is the whole point of the case.
      const before = await api.get(`/orders/${order.id}`);
      expect(before.data.dispatchDelayDays ?? null).toBeNull();

      await api.post(`${MAPPING}/${row.id}/allocations`, {
        poLineItemId: line.id, orderId: order.id, qty: 100,
      });

      const after = await api.get(`/orders/${order.id}`);
      expect(after.data.dispatchDelayDays).toBeGreaterThan(0);
      expect(after.data.dispatchDelaySource).toContain(PO_NUMBER);
    } finally {
      await api.dispose();
    }

    // And the drawer tells the user that is what mapping does.
    const drawer = await openPoDrawer(page);
    await expect(drawer.getByText(/slip carries through to the orders mapped here/i)).toBeVisible();
  });
});
