/**
 * Canonical label formatters for HR selectors and grids.
 *
 * The backend exposes employees in two deliberately different shapes:
 *
 *  - EmployeeListDTO / EmployeeDTO  -> `fullName`    (live employee master record)
 *  - Transaction record DTOs        -> `employeeName` (denormalised snapshot taken
 *    (BonusRecordDTO, FnfSettlementDTO,  when the record was created, so historical
 *     SalaryRecordDTO, ...)              documents keep the name they were issued under)
 *
 * Both carry `employeeNo`. Read each shape with its matching helper rather than
 * falling back across field names — a silent fallback would mask the next
 * contract change instead of surfacing it.
 */

/** Live employee record from /hr/employees/search (EmployeeListDTO). */
export const employeeLabel = (e) =>
  e ? [e.employeeNo, e.fullName].filter(Boolean).join(' - ') : '';

/** Options for a live-employee Select. */
export const employeeOptions = (list = []) =>
  list.map((e) => ({ value: e.id, label: employeeLabel(e) }));

/** Denormalised employee snapshot carried on a transaction record. */
export const recordEmployeeLabel = (r) =>
  r ? [r.employeeNo, r.employeeName].filter(Boolean).join(' - ') : '';

/**
 * Unit record (UnitDTO) — the field is `unitName`, not `name`.
 *
 * Renders as "Avarsh Apparels, Unit 1": the name alone, because unit names are
 * now unique and the name is what a user recognises. The code it used to lead
 * with survives only as the token inside an asset ID (SEW-U1-01001), which is
 * no reason to put it in front of every dropdown.
 *
 * Unlike employeeLabel, which keeps the employee number because two people
 * genuinely do share a name.
 */
export const unitLabel = (f) => (f ? (f.unitName || '') : '');

/** Options for a unit Select. */
export const unitOptions = (list = []) =>
  list.map((f) => ({ value: f.id, label: unitLabel(f) }));
