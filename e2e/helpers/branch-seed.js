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

/**
 * A CONFIRMED order with a BOM and a real quantity — what the production and
 * allocation specs need. The quantity check matters: by the time these specs
 * run in a full suite, earlier suites have created orders of their own, and an
 * order of zero pieces cannot be split (the rows are @Min(1)).
 */
export async function eligibleOrder(api) {
  const { data } = await api.get('/production/eligible-orders');
  const list = Array.isArray(data) ? data : [];
  for (const candidate of list) {
    const { data: row } = await api.get(`/orders/${candidate.id}`);
    if (!row || !(row.totalOrderQty > 0)) continue;
    const { data: detail } = await api.get(`/production/eligible-orders/${candidate.id}`);
    if (detail) return detail;
  }
  return null;
}

/** True once the one-time opening-stock cut-over is locked; the endpoints then refuse everything. */
export async function openingStockFinalized(api) {
  const { data } = await api.get('/opening-stock/status');
  return Boolean(data?.finalized);
}
