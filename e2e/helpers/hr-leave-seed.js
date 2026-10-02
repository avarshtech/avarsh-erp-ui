/**
 * The leave specs pick "the first leave type" in the Apply Leave drawer. The e2e data seeds none, and the
 * masters spec that creates leave types runs after the leave specs, so the select was empty and every leave
 * flow timed out waiting for an option. One active, paid type open to every category is enough; an existing
 * one is reused, so a rerun does not pile them up.
 */
export async function ensureLeaveType(api) {
  const active = (await api.get('/hr/leave-types/active')).data || [];
  const usable = active.find((t) => !t.applicableCategory && t.isPaid !== false);
  if (usable) return usable;

  const created = await api.post('/hr/leave-types', {
    code: 'E2ECL',
    name: 'E2E Casual Leave',
    daysPerYear: 12,
    accrualType: 'ANNUAL',
    isActive: true,
    isCarryForward: false,
    isEncashable: false,
    maxAccumulation: 0,
    maxCarryForward: 0,
  });
  if (created.status >= 300) {
    throw new Error(`Could not create the e2e leave type: ${created.status} ${JSON.stringify(created.data)}`);
  }
  return created.data;
}
