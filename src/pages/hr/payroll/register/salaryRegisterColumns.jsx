import dayjs from 'dayjs';
import { formatAmount } from '../../../../utils/formatters';

/**
 * Money, as the register reads it: whole rupees, grouped thousands, a dash for nothing.
 *
 * No paise. The server has already rounded every figure to the rupee the way the
 * hand-kept workbook does, so showing two decimals here would print ".00" on fifty
 * columns and suggest a precision the sheet does not carry.
 */
const money = (v) => formatAmount(v, { minDecimals: 0, maxDecimals: 0, empty: '-' });

/** Days read as 22.5, not 22.50, and nothing as a dash. */
const days = (v) => (v == null || Number.isNaN(Number(v)) ? '-' : String(Number(v)));

const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');

const text = (v) => v || '-';

const amountCol = (title, key, width = 110) => ({
  title, dataIndex: key, key, width, align: 'right', render: money,
});

const dayCol = (title, key, width = 95) => ({
  title, dataIndex: key, key, width, align: 'right', render: days,
});

/**
 * The register's columns, grouped the way the sheet bands them.
 *
 * <p>Out of the screen file for two reasons: fifty columns is most of a file on its own
 * and the screen has a 400-line ceiling, and a column list is the part somebody comes
 * back to change. Each group is a parent column with `children`, which is what gives the
 * two-row header the workbook has.</p>
 *
 * <p>The identity columns are fixed left. With fifty columns the deductions are a long
 * way right of the name, and a row you cannot put a name to is a row you cannot check.</p>
 */
export const salaryRegisterColumns = () => [
  {
    title: 'Sl.No', dataIndex: 'serial', key: 'serial', width: 70, fixed: 'left', align: 'right',
  },
  {
    title: 'Emp.Id', dataIndex: 'employeeNo', key: 'employeeNo', width: 90, fixed: 'left', render: text,
  },
  {
    title: 'Name Of Employee',
    dataIndex: 'employeeName',
    key: 'employeeName',
    width: 200,
    fixed: 'left',
    render: text,
  },
  { title: 'PF.NO', dataIndex: 'pfNumber', key: 'pfNumber', width: 150, render: text },
  { title: 'ESI.NO', dataIndex: 'esiNumber', key: 'esiNumber', width: 130, render: text },
  { title: 'AccNo', dataIndex: 'accountNumber', key: 'accountNumber', width: 170, render: text },
  {
    title: "Father/Husband's Name", dataIndex: 'fatherHusbandName', key: 'fatherHusbandName', width: 190, render: text,
  },
  {
    title: 'Date of Joining', dataIndex: 'dateOfJoining', key: 'dateOfJoining', width: 125, render: date,
  },
  { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 150, render: text },
  { title: 'Department', dataIndex: 'department', key: 'department', width: 140, render: text },
  { title: 'Unit', dataIndex: 'unitName', key: 'unitName', width: 85, render: text },

  {
    title: 'Attendance',
    key: 'attendance',
    children: [
      dayCol('Present Days', 'presentDays', 110),
      dayCol('Sunday', 'weeklyOffDays'),
      dayCol('CL', 'clDays', 70),
      dayCol('EL', 'elDays', 70),
      dayCol('Payable days', 'payableDays', 110),
      dayCol('OverTime', 'otHours', 100),
      dayCol('NH/FH Days', 'nhDays', 105),
      dayCol('LOP', 'lopDays', 80),
    ],
  },
  {
    title: 'Fixed Salary / Month',
    key: 'fixed',
    children: [
      amountCol('BASIC', 'fixedBasic'),
      amountCol('DA', 'fixedDa'),
      amountCol('HRA', 'fixedHra'),
      amountCol('CA', 'fixedCa', 100),
      amountCol('WA', 'fixedWa', 100),
      amountCol('Total', 'fixedGross', 120),
    ],
  },
  {
    title: 'Earned Salary',
    key: 'earned',
    children: [
      amountCol('BASIC', 'earnedBasic'),
      amountCol('DA', 'earnedDa'),
      amountCol('BASIC + DA', 'earnedBasicDa', 120),
      amountCol('HRA', 'earnedHra'),
      amountCol('CA', 'earnedCa', 100),
      amountCol('WA', 'earnedWa', 100),
      amountCol('Earned Gross', 'earnedGross', 125),
      amountCol('OT', 'otAmount', 100),
      amountCol('Incentive', 'incentive'),
      amountCol('Total', 'totalEarnings', 120),
    ],
  },
  {
    // The wages each contribution was worked out on, which is what makes a disputed
    // PF or ESI figure checkable without opening the payslip.
    title: 'Contribution Wages',
    key: 'wages',
    children: [
      amountCol('PF Wages', 'pfWages'),
      amountCol('ESI Wages', 'esiWages'),
    ],
  },
  {
    title: 'Deductions',
    key: 'deductions',
    children: [
      amountCol('PF', 'pfEmployee', 100),
      amountCol('ESI', 'esiEmployee', 100),
      amountCol('PT', 'professionalTax', 90),
      amountCol('LWF', 'lwf', 90),
      amountCol('Advance', 'advanceRecovery'),
      amountCol('Total', 'totalDeductions', 120),
    ],
  },
  {
    title: 'Net Payable',
    dataIndex: 'netPayable',
    key: 'netPayable',
    width: 130,
    align: 'right',
    render: (v) => <strong>{money(v)}</strong>,
  },
  {
    // What the employee costs the company, which is not what the company paid them.
    // None of it is deducted from anybody and none of it is on a payslip.
    title: 'Cost to Company',
    key: 'cost',
    children: [
      amountCol('EER EPF', 'employerPf'),
      amountCol('EER ESI', 'employerEsi'),
      amountCol('BASIC +DA', 'earnedBasicDa', 120),
      amountCol('EL', 'elProvision', 100),
      amountCol('BONUS', 'bonusProvision'),
      amountCol('GRATUITY', 'gratuityProvision'),
      amountCol('CTC', 'ctc', 120),
      amountCol('TOTAL CTC', 'totalCtc', 130),
    ],
  },
];

/** The leaf columns, in order - what the TOTAL row has to line up with. */
export const leafColumns = (columns) =>
  columns.flatMap((column) => (column.children ? column.children : [column]));

export { money as registerMoney, days as registerDays };
