/**
 * HR Employee — Bulk Creation + CRUD E2E Tests (Headed + Slow)
 *
 * What this tests:
 *   - Seeds master data if missing (Factory, Department, Designation, Shift)
 *   - Employee list page loads with table and filters
 *   - Create 12 employees with ALL fields filled (Personal + Employment tabs)
 *   - View employee detail page after creation
 *   - Edit an employee and verify update
 *   - Search/filter employees by name, category
 *
 * Prerequisites:
 *   - Backend running at E2E_API_URL
 *   - UI running at E2E_BASE_URL
 *   - superadmin user with full permissions
 */

import { test, expect } from '@playwright/test';
import {
  antDatePickerToday,
  antTableWaitForData,
  antMessageContains,
  antFormFill,
} from '../../helpers/antd-helpers.js';
import {
  navigateWithAuth,
  ensureSessionActive,
  waitForPageReady,
} from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

const STAMP = () => Date.now().toString().slice(-6);

// ── Master data IDs (seeded in beforeAll) ──
let factoryId, departmentId, designationId, shiftId;
let api;

// ── 12 varied employee profiles ──
const EMPLOYEE_PROFILES = [
  { fullName: 'Rajesh Kumar',       gender: 'MALE',   category: 'WORKER', type: 'PERMANENT', father: 'Suresh Kumar' },
  { fullName: 'Priya Sharma',       gender: 'FEMALE', category: 'STAFF',  type: 'PERMANENT', father: 'Ramesh Sharma' },
  { fullName: 'Mohammed Ali',       gender: 'MALE',   category: 'WORKER', type: 'TEMPORARY', father: 'Ahmed Ali' },
  { fullName: 'Lakshmi Devi',       gender: 'FEMALE', category: 'WORKER', type: 'CONTRACT',  father: 'Rajan Devi' },
  { fullName: 'Suresh Babu',        gender: 'MALE',   category: 'STAFF',  type: 'PERMANENT', father: 'Mohan Babu' },
  { fullName: 'Anitha Kumari',      gender: 'FEMALE', category: 'WORKER', type: 'PERMANENT', father: 'Kannan Kumari' },
  { fullName: 'Venkatesh Reddy',    gender: 'MALE',   category: 'STAFF',  type: 'TRAINEE',   father: 'Srinivas Reddy' },
  { fullName: 'Kavitha Naidu',      gender: 'FEMALE', category: 'STAFF',  type: 'PERMANENT', father: 'Krishna Naidu' },
  { fullName: 'Gopal Krishnan',     gender: 'MALE',   category: 'WORKER', type: 'CONTRACT',  father: 'Iyer Krishnan' },
  { fullName: 'Meena Sundaram',     gender: 'FEMALE', category: 'WORKER', type: 'TEMPORARY', father: 'Ravi Sundaram' },
  { fullName: 'Arjun Patel',        gender: 'MALE',   category: 'STAFF',  type: 'PERMANENT', father: 'Jayesh Patel' },
  { fullName: 'Deepa Murugan',      gender: 'FEMALE', category: 'WORKER', type: 'PERMANENT', father: 'Murugan S' },
];

/**
 * Pick an option from an Ant Design Select by its input element's CSS #id.
 * If optionTitle is provided, selects that specific option (exact title match).
 * If optionTitle is null/undefined, selects the first available option.
 */
async function pickSelectById(page, idSelector, optionTitle) {
  await page.locator(idSelector).click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });

  if (optionTitle) {
    await dropdown.getByTitle(optionTitle, { exact: true }).click();
  } else {
    await dropdown.locator('.ant-select-item-option').first().click();
  }
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Select a Gender option using form item label + exact title match.
 * Gender label doesn't have asterisk issues since it uses getByTitle.
 */
async function selectOption(page, labelText, optionTitle) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: labelText }).first();
  const select = formItem.locator('.ant-select').first();
  await select.click();

  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await dropdown.getByTitle(optionTitle, { exact: true }).click();
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Helper: Create a single employee through the UI form.
 * Fills ALL fields on Personal + Employment tabs.
 */
async function createEmployeeViaForm(page, profile, stamp) {
  await navigateWithAuth(page, '/hr/employees/new');
  await waitForPageReady(page);

  // Wait for form to be ready (dropdowns loaded)
  await page.getByText('New Employee').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // ── Personal Tab (default active) ──
  // Fill ALL required DB fields: fullName, gender, dateOfBirth, maritalStatus, mobileNumber, presentAddress
  await antFormFill(page, 'Full Name', `${profile.fullName} ${stamp}`);
  await antFormFill(page, 'Father/Husband Name', profile.father);

  // Gender — use exact title match
  await selectOption(page, 'Gender', profile.gender === 'MALE' ? 'Male' : 'Female');

  // Date of Birth — required in DB (NOT NULL)
  const dobFormItem = page.locator('.ant-form-item').filter({ hasText: 'Date of Birth' }).first();
  await antDatePickerToday(page, dobFormItem.locator('.ant-picker').first());

  // Marital Status — required in DB (NOT NULL)
  await selectOption(page, 'Marital Status', 'Single');

  // Mobile Number — unique per run
  await antFormFill(page, 'Mobile Number', `9${stamp}${String(Math.floor(Math.random() * 9000) + 1000)}`);

  // Present Address — required in DB (NOT NULL, TEXT)
  const addressTextarea = page.locator('.ant-form-item').filter({ hasText: 'Present Address' }).first().locator('textarea').first();
  await addressTextarea.fill(`${stamp} Test Street, Tirupur, Tamil Nadu`);

  // ── Employment Tab ──
  await page.getByRole('tab', { name: 'Employment' }).click();
  await page.waitForTimeout(500); // tab transition

  // Use #id selectors for Ant Design Selects — most reliable on this form
  // (accessible names include asterisks like "* Department" which break role matching)

  // Employee No — required unique NOT NULL in DB; auto-generates if blank, but we fill it for clarity
  const empNoInput = page.locator('#employeeNo');
  if (await empNoInput.isEnabled().catch(() => false)) {
    await empNoInput.fill(`E2E-${stamp}-${Math.floor(Math.random() * 9000) + 1000}`);
  }

  // Department — select first available
  await pickSelectById(page, '#departmentId');
  await page.waitForTimeout(300);

  // Designation — select first available
  await pickSelectById(page, '#designationId');
  await page.waitForTimeout(300);

  // Factory — select first available
  await pickSelectById(page, '#factoryId');
  await page.waitForTimeout(300);

  // Shift — required NOT NULL in DB
  await pickSelectById(page, '#shiftId');
  await page.waitForTimeout(300);

  // Category — exact option match
  await pickSelectById(page, '#category', profile.category === 'WORKER' ? 'Worker' : 'Staff');
  await page.waitForTimeout(300);

  // Employee Type — exact option match
  const typeMap = { PERMANENT: 'Permanent', TEMPORARY: 'Temporary', CONTRACT: 'Contract', TRAINEE: 'Trainee' };
  await pickSelectById(page, '#employeeType', typeMap[profile.type]);

  // Date of Joining — pick today
  const dojFormItem = page.locator('.ant-form-item').filter({ hasText: 'Date of Joining' }).first();
  await antDatePickerToday(page, dojFormItem.locator('.ant-picker').first());

  // ── Save ──
  const responsePromise = page.waitForResponse(
    (r) => {
      const isEmployeePost = r.url().endsWith('/hr/employees') && r.request().method() === 'POST';
      if (isEmployeePost) {
        // Log the request body to see what the form actually sends
        const reqBody = r.request().postData();
        console.log(`[E2E] Employee POST request body: ${reqBody}`);
        console.log(`[E2E] Employee POST response: ${r.status()}`);
      }
      return isEmployeePost;
    },
    { timeout: 30000 }
  );

  await page.getByRole('button', { name: /Save/i }).click();
  const saveResp = await responsePromise;

  if (saveResp.status() >= 400) {
    const body = await saveResp.json().catch(() => saveResp.text().catch(() => 'unreadable'));
    console.log(`[E2E] Error ${saveResp.status()} body: ${JSON.stringify(body)}`);
  }
  expect(saveResp.status()).toBeGreaterThanOrEqual(200);
  expect(saveResp.status()).toBeLessThan(300);

  // Should see success toast
  await antMessageContains(page, /created|success/i);

  // Should redirect to employee list
  await page.waitForURL(/\/hr\/employees/, { timeout: 15000 });
}

// ── Seed master data via API before tests ──
test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  const stamp = STAMP();

  // 1. Create Factory (or use existing)
  const factoriesResp = await api.get('/factories/active');
  if (factoriesResp.data && factoriesResp.data.length > 0) {
    factoryId = factoriesResp.data[0].id;
  } else {
    const createFactory = await api.post('/factories', {
      factoryCode: `E2E-FAC-${stamp}`,
      factoryName: `E2E Test Factory ${stamp}`,
      city: 'Tirupur',
      state: 'TN',
      isActive: true,
    });
    factoryId = createFactory.data?.id;
  }

  // 2. Create Department (or use existing)
  const deptsResp = await api.get('/hr/departments/active');
  if (deptsResp.data && deptsResp.data.length > 0) {
    departmentId = deptsResp.data[0].id;
  } else {
    const createDept = await api.post('/hr/departments', {
      code: `E2E-DEP-${stamp}`,
      name: `E2E Department ${stamp}`,
      factoryId,
      isActive: true,
    });
    departmentId = createDept.data?.id;
  }

  // 3. Create Designation (or use existing)
  const designResp = await api.get('/hr/designations/active');
  if (designResp.data && designResp.data.length > 0) {
    designationId = designResp.data[0].id;
  } else {
    const createDesig = await api.post('/hr/designations', {
      code: `E2E-DES-${stamp}`,
      name: `E2E Designation ${stamp}`,
      departmentId,
      category: 'WORKER',
      isActive: true,
    });
    designationId = createDesig.data?.id;
  }

  // 4. Create Shift (or use existing)
  const shiftsResp = await api.get('/hr/shifts/active');
  if (shiftsResp.data && shiftsResp.data.length > 0) {
    shiftId = shiftsResp.data[0].id;
  } else {
    const createShift = await api.post('/hr/shifts', {
      code: `E2E-SFT-${stamp}`,
      name: `E2E General Shift ${stamp}`,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 30,
      isNightShift: false,
      isActive: true,
    });
    shiftId = createShift.data?.id;
  }

  console.log(`[E2E Setup] Factory=${factoryId}, Dept=${departmentId}, Desig=${designationId}, Shift=${shiftId}`);
});

test.afterAll(async () => {
  await api?.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`);
  });
});

test.describe('HR Employee — List Page', () => {
  test('Employee list page loads with table and filters', async ({ page }) => {
    await navigateWithAuth(page, '/hr/employees');
    await waitForPageReady(page);

    // Page title (use heading role to avoid breadcrumb conflict)
    await expect(page.getByRole('heading', { name: 'Employees' }).first()).toBeVisible({ timeout: 10000 });

    // Table is visible
    await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 });

    // Add Employee button
    await expect(page.getByRole('button', { name: /Add Employee/i })).toBeVisible();

    // Search input
    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible();
  });
});

test.describe('HR Employee — Bulk Creation (12 employees)', () => {
  for (let i = 0; i < EMPLOYEE_PROFILES.length; i++) {
    const profile = EMPLOYEE_PROFILES[i];
    test(`Create employee ${i + 1}/12: ${profile.fullName} (${profile.category}/${profile.type})`, async ({ page }) => {
      const stamp = STAMP();
      await createEmployeeViaForm(page, profile, stamp);

      // Verify we're back on the list page
      await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });
    });
  }
});

test.describe('HR Employee — View & Edit', () => {
  test('View employee detail page from list', async ({ page }) => {
    await navigateWithAuth(page, '/hr/employees');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No employees to view');

    // Click the first row to navigate to view page
    await rows.first().click();

    // Should navigate to employee view page
    await page.waitForURL(/\/hr\/employees\/\d+/, { timeout: 15000 });
    await waitForPageReady(page);

    // Should show employee details with tabs
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible({ timeout: 10000 });
  });

  test('Edit employee — update mobile number', async ({ page }) => {
    const stamp = STAMP();

    await navigateWithAuth(page, '/hr/employees');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const rows = page.locator('.ant-table-row');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No employees to edit');

    // Click the edit icon on the first row
    const editBtn = rows.first().locator('button:has(.anticon-edit)');
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
    } else {
      // Fallback: click row then navigate to edit
      await rows.first().click();
      await page.waitForURL(/\/hr\/employees\/\d+/, { timeout: 15000 });
      const editNavBtn = page.getByRole('button', { name: /Edit/i });
      if (await editNavBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editNavBtn.click();
      } else {
        test.skip(true, 'Edit button not available');
        return;
      }
    }

    // Wait for edit form
    await page.waitForURL(/\/hr\/employees\/edit\/\d+/, { timeout: 15000 });
    await waitForPageReady(page);
    await expect(page.getByText('Edit Employee').first()).toBeVisible({ timeout: 10000 });

    // Update mobile number on Personal tab
    const mobileInput = page.locator('.ant-form-item').filter({ hasText: 'Mobile Number' }).first().locator('input').first();
    await mobileInput.clear();
    await mobileInput.fill(`9999${stamp}`);

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/hr/employees') && r.request().method() === 'PUT',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);

    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);

    await antMessageContains(page, /updated|success/i);
  });
});

test.describe('HR Employee — Filters', () => {
  test('Search employees by name filters results', async ({ page }) => {
    await navigateWithAuth(page, '/hr/employees');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No employees to filter');

    // Search with a term unlikely to match
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill('ZZZNOMATCH999');

    // Wait for debounce + API
    await page.waitForTimeout(500);
    await page.waitForResponse(
      (r) => r.url().includes('/hr/employees/search'),
      { timeout: 10000 }
    ).catch(() => {});

    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThan(initialCount);
  });
});
