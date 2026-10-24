/**
 * HR — Daily Strength Report, and contractor data being the administrator's alone.
 *
 * Seeds one unit of its own (so other specs' employees never change these figures) with a day
 * of attendance that exercises every counting rule, then checks the figures through the API and
 * the screen, as the superuser and as a user on the ordinary "Admin" role:
 *
 *   Tailor   x4  permanent   PRESENT, ABSENT, HALF_DAY, (not marked)
 *   Tailor   x2  contract    PRESENT, ABSENT        — under the seeded contractor
 *   Tailor   x1  new joiner  PRESENT                — joined the day before
 *   Helper   x1  permanent   LEAVE
 *
 *   strength 8 · present 3.5 · absent 3.5 · not marked 1 · Absent % 50
 *
 * Prerequisites: e2e API (H2) and UI running — see e2e/README.md.
 */
import { test, expect } from '../../fixtures.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { E2E_API_URL } from '../../config/env.js';

const STAMP = Date.now().toString().slice(-6);
const ADMIN_ROLE_USER = { username: `e2e-str-admin-${STAMP}`, password: 'Strength@123' };

const iso = (d) => d.toISOString().slice(0, 10);
const DAY = new Date(Date.now() - 2 * 86400000);
const DATE = iso(DAY);
const JOINED_LONG_AGO = '2020-01-01';
const JOINED_YESTERDAY = iso(new Date(DAY.getTime() - 86400000));

const seeded = {};

const must = (res, what) => {
  if (res.status >= 300) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ api }) => {
  const unit = must(await api.post('/units', { unitName: `STR${STAMP}`, isActive: true }), 'unit');
  const dept = must(await api.post('/hr/departments', { name: 'Production', unitId: unit.id, isActive: true }), 'department');
  const tailor = must(await api.post('/hr/designations', { name: 'Tailor', departmentId: dept.id, category: 'WORKER', isActive: true }), 'tailor');
  const helper = must(await api.post('/hr/designations', { name: 'Helper', departmentId: dept.id, category: 'WORKER', isActive: true }), 'helper');
  const shifts = must(await api.get('/hr/shifts/active'), 'shifts');
  const shift = shifts[0] ?? must(await api.post('/hr/shifts', {
    code: `STR-${STAMP}`, name: `E2E Shift ${STAMP}`, startTime: '08:00', endTime: '17:00',
    breakMinutes: 30, isNightShift: false, isActive: true,
  }), 'shift');
  const contractor = must(await api.post('/hr/contractors', { name: `E2E Contractor ${STAMP}`, isActive: true }), 'contractor');
  const leaveTypes = must(await api.get('/hr/leave-types/active'), 'leave types');

  let n = 0;
  const hire = async (designation, { type = 'PERMANENT', joined = JOINED_LONG_AGO, contractorId, status, extra = {} }) => {
    n += 1;
    const emp = must(await api.post('/hr/employees', {
      employeeNo: `STR${STAMP}-${n}`, fullName: `Strength Worker ${n}`, gender: 'FEMALE',
      dateOfBirth: '1995-05-05', dateOfJoining: joined, maritalStatus: 'SINGLE',
      unitId: unit.id, departmentId: dept.id, designationId: designation.id, shiftId: shift.id,
      category: 'WORKER', employeeType: type, contractorId, status: 'ACTIVE',
      presentAddress: 'Tirupur', mobileNumber: `90000${STAMP}`.slice(0, 10),
    }), `employee ${n}`);
    if (status) {
      must(await api.post('/hr/attendance', { employeeId: emp.id, attendanceDate: DATE, status, ...extra }), `attendance ${n}`);
    }
    return emp;
  };

  await hire(tailor, { status: 'PRESENT' });
  await hire(tailor, { status: 'ABSENT' });
  await hire(tailor, { status: 'HALF_DAY', extra: { halfDaySession: 'FIRST_HALF' } });
  await hire(tailor, {});
  seeded.contractWorker = await hire(tailor, { type: 'CONTRACT', contractorId: contractor.id, status: 'PRESENT' });
  await hire(tailor, { type: 'CONTRACT', contractorId: contractor.id, status: 'ABSENT' });
  await hire(tailor, { joined: JOINED_YESTERDAY, status: 'PRESENT' });
  await hire(helper, { status: 'LEAVE', extra: leaveTypes[0] ? { leaveTypeId: leaveTypes[0].id } : {} });

  const roles = must(await api.get('/roles'), 'roles');
  const adminRole = (roles.content ?? roles).find((r) => r.name === 'Admin');
  must(await api.post('/users', {
    name: 'Strength Admin-role User', username: ADMIN_ROLE_USER.username, password: ADMIN_ROLE_USER.password,
    email: `${ADMIN_ROLE_USER.username}@avarsh.com`, roleId: adminRole.id, isActive: true,
  }), 'admin-role user');

  Object.assign(seeded, { unit, contractor });
});

const reportParams = () => ({ date: DATE, unitId: seeded.unit.id, joinedFrom: JOINED_YESTERDAY, joinedTo: DATE });

test('superuser: figures follow the counting rule, and contract labour is split out', async ({ api }) => {
  const r = must(await api.get('/hr/reports/strength', reportParams()), 'report');

  expect(r.contractorView).toBe(true);
  expect(r.total).toMatchObject({ strength: 8, present: 3.5, absent: 3.5, notMarked: 1, off: 0, newJoiners: 1 });
  expect(r.total.absentPct).toBe(50);

  const depts = r.units[0].departments;
  expect(depts.map((d) => d.departmentName)).toEqual(['Production', `Contract - ${seeded.contractor.name}`]);
  expect(depts[1].total.strength).toBe(2);
  expect(depts.reduce((s, d) => s + d.total.strength, 0)).toBe(r.units[0].total.strength);

  expect(r.focus.rows.map((row) => [row.kind, row.counts.strength])).toEqual([
    ['UNIT', 4], ['CONTRACTOR', 2], ['NEW_JOINERS', 1],
  ]);
  expect(r.contractLabour.rows).toHaveLength(1);
});

test('Admin role (not superuser): same totals, no trace of the contractor anywhere', async () => {
  const other = await createAuthenticatedClient(ADMIN_ROLE_USER.username, ADMIN_ROLE_USER.password);
  try {
    const r = must(await other.get('/hr/reports/strength', reportParams()), 'report');
    expect(r.contractorView).toBe(false);
    expect(r.contractLabour).toBeNull();
    expect(r.total).toMatchObject({ strength: 8, present: 3.5, absent: 3.5 });
    expect(r.units[0].departments.map((d) => d.departmentName)).toEqual(['Production']);
    expect(JSON.stringify(r)).not.toContain(seeded.contractor.name);

    expect((await other.get('/hr/contractors')).status).toBe(403);
    const emp = must(await other.get(`/hr/employees/${seeded.contractWorker.id}`), 'employee');
    expect(emp.contractorId ?? null).toBeNull();
    expect(emp.contractorName ?? null).toBeNull();
  } finally {
    await other.dispose();
  }
});

// No consoleGuard: the sidebar on dev logs "Duplicated key '/assets'" on every page, which is not this screen's.
test('superuser screen: table, totals, contract card, and both downloads', async ({ authedPage: page }) => {
  await page.goto(`/hr/attendance/strength?date=${DATE}&unitId=${seeded.unit.id}`);
  await expect(page.getByText('Daily Strength Report')).toBeVisible();

  const table = page.locator('.ant-table').filter({ hasText: 'Grand total' });
  await expect(table).toContainText(`Contract - ${seeded.contractor.name}`);
  await expect(table.locator('tr', { hasText: 'Grand total' })).toContainText('50.0%');
  await expect(page.getByText('Contract labour - by contractor')).toBeVisible();
  await expect(page.getByText('no attendance marked for this day')).toBeVisible();

  for (const [button, ext] of [['Excel', 'xlsx'], ['PDF', 'pdf']]) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: button }).click();
    expect((await download).suggestedFilename()).toBe(`Strength_${DATE}.${ext}`);
  }
  await page.screenshot({ path: 'test-results/strength-report-superuser.png', fullPage: true });
});

test('Admin-role screen: no contract block, card or tab', async ({ page, baseURL }) => {
  const login = await page.context().request.post(`${E2E_API_URL}/auth/login`, {
    data: { username: ADMIN_ROLE_USER.username, password: ADMIN_ROLE_USER.password },
  });
  expect(login.ok()).toBeTruthy();
  await page.addInitScript((origin) => {
    if (window.location.origin !== origin) return;
    localStorage.setItem('sessionActive', 'true');
    localStorage.setItem('avarsh-notif-prompt-dismissed', String(Date.now()));
  }, new URL(baseURL).origin);

  await page.goto(`/hr/attendance/strength?date=${DATE}&unitId=${seeded.unit.id}`);
  const table = page.locator('.ant-table').filter({ hasText: 'Grand total' });
  await expect(table).toBeVisible();
  await expect(page.getByText(seeded.contractor.name)).toHaveCount(0);
  await expect(page.getByText('Contract labour - by contractor')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/strength-report-admin-role.png', fullPage: true });

  await page.goto('/hr/masters');
  await expect(page.getByText('Units').first()).toBeVisible();
  await expect(page.getByText('Contractors')).toHaveCount(0);
});
