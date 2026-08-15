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

/** Factory record (FactoryDTO) — note the field is `factoryName`, not `name`. */
export const factoryLabel = (f) => f?.factoryName ?? '';

/** Options for a factory Select. */
export const factoryOptions = (list = []) =>
  list.map((f) => ({ value: f.id, label: factoryLabel(f) }));
