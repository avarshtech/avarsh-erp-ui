/**
 * Branch fixtures for the branch/unit suites.
 *
 * The seeded company has exactly one branch (Head Office), which is what makes
 * the single-branch rule testable: every branch field, column and switcher is
 * hidden until a second ACTIVE branch exists. Specs that need the multi-branch
 * shape create one here and `restoreSingleBranch` puts the company back, so the
 * rest of the suite keeps seeing the single-branch UI it was written against.
 */

/** Working-branch header — what the switcher sends on every request. */
export const branchHeader = (branchId) => ({ 'X-Branch-Id': String(branchId) });

export async function activeBranches(api) {
  const { data } = await api.get('/branches/active');
  return Array.isArray(data) ? data : [];
}

export async function headOffice(api) {
  const list = await activeBranches(api);
  return list.find((b) => b.isHeadOffice) || list[0];
}

/**
 * A branch with this code, created if it is missing and re-activated if a
 * previous run deactivated it. Returns the full branch row.
 */
export async function ensureBranch(api, { branchCode, branchName, stateCode = '33', ...rest }) {
  const { data: all } = await api.get('/branches');
  const existing = (all || []).find((b) => b.branchCode === branchCode);
  if (existing) {
    if (existing.isActive === false) {
      const { data } = await api.put(`/branches/${existing.id}`, { ...existing, isActive: true });
      return data;
    }
    return existing;
  }
  const { data, status } = await api.post('/branches', { branchCode, branchName, stateCode, isActive: true, ...rest });
  if (status >= 300) throw new Error(`Could not create branch ${branchCode}: ${status} ${JSON.stringify(data)}`);
  return data;
}

/** Deactivates every branch except the head office — the company reads as single-branch again. */
export async function restoreSingleBranch(api) {
  const { data: all } = await api.get('/branches');
  const extras = (all || []).filter((b) => !b.isHeadOffice && b.isActive !== false);
  for (const branch of extras) {
    await api.put(`/branches/${branch.id}`, { ...branch, isActive: false });
  }
  return extras.length;
}

/** A unit at this branch, created if the branch has none yet. */
export async function ensureUnit(api, branchId, { unitCode, unitName }) {
  const { data: all } = await api.get('/units');
  const existing = (all || []).find((f) => f.unitCode === unitCode);
  if (existing) return existing;
  const { data, status } = await api.post('/units', {
    unitCode, unitName, branchId, isActive: true,
  });
  if (status >= 300) throw new Error(`Could not create unit ${unitCode}: ${status} ${JSON.stringify(data)}`);
  return data;
}

/** The first CONFIRMED order with a BOM — what production and allocation specs need. */
export async function eligibleOrder(api) {
  const { data } = await api.get('/production/eligible-orders');
  const list = Array.isArray(data) ? data : [];
  if (!list.length) return null;
  const { data: detail } = await api.get(`/production/eligible-orders/${list[0].id}`);
  return detail;
}
