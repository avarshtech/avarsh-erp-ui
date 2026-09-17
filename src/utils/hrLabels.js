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
 * Unit record (UnitDTO) — the fields are `unitCode` and
 * `unitName`, not `code` and `name`.
 *
 * Renders as "FAC-A - Avarsh Apparels, Unit 1".
 *
 * Name alone is ambiguous once two units are named similarly, and the code
 * is what appears on the PF and ESI registrations, so it is the half people
 * recognise. Matches employeeLabel, which has always led with the code.
 */
export const unitLabel = (f) =>
  (f ? [f.unitCode, f.unitName].filter(Boolean).join(' - ') : '');

/** Options for a unit Select. */
export const unitOptions = (list = []) =>
  list.map((f) => ({ value: f.id, label: unitLabel(f) }));
