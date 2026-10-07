/**
 * The Virtual Factory opens against the real API: the 3D floor renders, the health score, the
 * attention list and the document rail appear, the organisation's health rules can be read, and a
 * simulation plays on today's floor. Headless Chromium draws WebGL with SwiftShader (project flags).
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';

const openFactory = async (page) => {
  await ensureSessionActive(page);
  await page.goto('/virtual-factory', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Virtual factory' })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.vf-canvas canvas')).toBeVisible({ timeout: 90000 });
};

test.describe('Virtual factory', () => {
  test('opens the floor with health, attention and the documents', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openFactory(page);
    await expect(page.getByRole('region', { name: 'Factory health' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Needs attention' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Orders and documents' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'What is happening' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shows the organisation health rules', async ({ page }) => {
    await openFactory(page);
    await page.getByRole('button', { name: 'Factory Health rules' }).click();
    const drawer = page.locator('.ant-drawer-open');
    await expect(drawer.getByText('Factory Health rules', { exact: true })).toBeVisible();
    await expect(drawer.getByText(/Score weights \(total \d+\)/)).toBeVisible();
    await expect(drawer.getByText('Line efficiency target')).toBeVisible();
  });

  test('plays a simulation and predicts the shipment', async ({ page }) => {
    await openFactory(page);
    await page.locator('.vf-topbar').getByText('Simulation', { exact: true }).click();
    const panel = page.getByRole('region', { name: 'Simulation', exact: true });
    await expect(panel.getByText('Predicted shipment')).toBeVisible();
    await panel.getByRole('button', { name: 'Add another sewing line' }).click();
    await page.getByText('10×', { exact: true }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('region', { name: 'Simulation playback' }).getByText(/day [2-9]/)).toBeVisible({ timeout: 60000 });
  });
});
