import { useState, useEffect, useCallback } from 'react';
import { Button, Spin } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSalarySlip } from '../../../services/hr/payrollService';
import { companyForPrint } from '../../../utils/printCompany';
import { formatAmount } from '../../../utils/formatters';
import L from './salarySlipLabels';
import './salarySlip.css';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Form 25B, as the floor reads it.
 *
 * <p>The slip used to show earnings alone, under a running total. The form a worker is
 * handed shows the structure beside them - ACTUALS, what a full month pays, against
 * EARNINGS, what this month paid - so somebody who lost three and a half days can see
 * where the difference went. Both numbers were already stored on the salary record;
 * the slip simply never showed the first column.</p>
 *
 * <p>Both languages on the same sheet, not one or the other: the form is printed once
 * and read by people who use different ones.</p>
 */

/**
 * A figure, or a dash. The form uses "-" for a line that does not apply.
 *
 * Whole rupees: the server rounds every figure on the slip and sums the totals from
 * the rounded parts, so the column adds up to the total printed under it. Showing two
 * decimals here would print ".00" down the sheet and suggest a precision the document
 * does not carry - the factory pays and files in rupees.
 */
const money = (v) => (v == null || Number(v) === 0
  ? '-'
  : formatAmount(v, { minDecimals: 0, maxDecimals: 0, empty: '-' }));

/** Days and hours read as 22.5, not 22.50. */
const num = (v) => (v == null ? '-' : String(Number(v)));

/**
 * A label in all three languages, stacked.
 *
 * English on top because that is what the form's own headings are, then Tamil and
 * Hindi beneath it. Tamil and Hindi share a line where they fit, so a third language
 * costs the row height of one line rather than two - which is what keeps two slips
 * on one A4.
 */
const Label = ({ k }) => (
  <>
    <span className="slip-en">{L[k].en}</span>
    <span className="slip-ta">{L[k].ta}</span>
    <span className="slip-hi">{L[k].hi}</span>
  </>
);

/** One of the small facts across the top of the form. */
const Fact = ({ k, children }) => (
  <div className="slip-fact">
    <div className="slip-fact-label"><Label k={k} /></div>
    <div className="slip-fact-value">{children ?? '-'}</div>
  </div>
);

/**
 * One line of the main grid.
 *
 * <p>The earnings side and the deductions side are different lengths, so the form runs
 * them as one table rather than two columns that drift apart. A row with nothing on one
 * side keeps its cells - Form 25B is a fixed layout, and dropping its empty lines would
 * make it a different document.</p>
 */
const Line = ({ earn, actual, earned, deduct, amount }) => (
  <tr>
    <td className="slip-particular">{earn ? <Label k={earn} /> : ''}</td>
    <td className="slip-figure">{actual === undefined ? '' : money(actual)}</td>
    <td className="slip-figure">{earned === undefined ? '' : money(earned)}</td>
    <td className="slip-particular">{deduct ? <Label k={deduct} /> : ''}</td>
    <td className="slip-figure">{amount === undefined ? '' : money(amount)}</td>
  </tr>
);

const SalarySlipView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [slip, setSlip] = useState(null);
  const [company, setCompany] = useState(null);

  const fetchSlip = useCallback(async () => {
    setLoading(true);
    try {
      setSlip(await getSalarySlip(id));
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSlip(); }, [fetchSlip]);

  /**
   * The name at the top of a payslip is the employer's, not the unit's. The slip
   * printed the unit - "B1" - which is where the person works, and the Dept line
   * already says that. Form 25B is issued by the company, and it is the company a
   * worker takes the slip to a bank or an inspector with.
   *
   * Cached in memory after login, so this normally resolves before first paint;
   * with no company profile configured it returns null and the header prints
   * blank, exactly as the asset labels and export invoices already do.
   */
  useEffect(() => {
    let alive = true;
    companyForPrint().then((org) => { if (alive) setCompany(org); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  if (!slip) return null;

  const period = `${MONTH_SHORT[(slip.month || 1) - 1]}-${slip.year}`;
  // Only the last four digits. The account number is encrypted at rest and this sheet
  // is printed and carried around a factory.
  const account = slip.accountNumber
    ? `XXXX${String(slip.accountNumber).slice(-4)}`
    : '-';

  // Form 25B has no washing-allowance line, so it is paid under Others. Added
  // rather than dropped: the column has to come to the total printed under it.
  const sum = (a, b) => (a == null && b == null ? null : Number(a || 0) + Number(b || 0));
  const otherFixed = sum(slip.fixedOther, slip.fixedWa);
  const otherEarned = sum(slip.earnedOther, slip.earnedWa);

  /**
   * Print, and have the saved PDF named after the slip.
   *
   * "Save as PDF" takes its file name from document.title, which is the app's -
   * so every payslip saved itself as "Avarsh ERP Dashboard" and a folder of them
   * was indistinguishable. It used to come out right only because the slip was
   * printed through a window of its own, and that window was dropped when it
   * started printing blank; the name went with it.
   *
   * The title is put back afterwards. afterprint fires whether the dialog is used
   * or cancelled, and the timeout covers the browsers that do not fire it at all -
   * leaving the app titled after one employee's payslip would be worse than the
   * problem being fixed.
   */
  const printSlip = () => {
    const previous = document.title;
    const safe = (value) => String(value ?? '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
    const name = ['Payslip', safe(slip.employeeNo), safe(period)].filter(Boolean).join('_');

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };

    document.title = name;
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1000);
  };

  /**
   * The slip, sized to half an A4.
   *
   * Not two copies - one slip whose box is half the sheet, so the other half is
   * free for the next one. The form is issued at that size, and a printer loaded
   * with A4 should get two slips out of a page rather than one and a blank half.
   */
  const sheet = () => (
    <div className="slip-sheet">
          <header className="slip-head">
            <div className="slip-company">{company?.organisationName || ''}</div>
            <div className="slip-title">
              <Label k="payslip" /> <span className="slip-form-no">{L.formNo.en}</span>
            </div>
            <div className="slip-period">
              <Label k="salaryMonth" /> <strong>{period}</strong>
            </div>
          </header>

          {/* Three across, not two. The sheet is half an A4 printed wide, so the room
              is horizontal - stacked in two columns these thirteen facts ran the page
              over onto a second one. Who the person is, then their numbers, then the
              days that made up the month. */}
          <section className="slip-facts">
            <Fact k="name">{slip.employeeName}</Fact>
            <Fact k="idNo">{slip.employeeNo}</Fact>
            <Fact k="earnDays">
              {num(slip.payableDays)}
              {slip.wageDaysBasis != null && (
                <span className="slip-of"> / {num(slip.wageDaysBasis)}</span>
              )}
            </Fact>

            <Fact k="fatherHusbandName">{slip.fatherHusbandName}</Fact>
            <Fact k="pfNo">{slip.pfNumber}</Fact>
            <Fact k="lopDays">{num(slip.lopDays)}</Fact>

            <Fact k="dept">{slip.departmentName}</Fact>
            <Fact k="esiNo">{slip.esiNumber}</Fact>
            {/* Taken this month, not the balance left: it reads with LOP Days as an
                account of where the month's missing days went. */}
            <Fact k="leaveDetails">
              EL {num(slip.elDays)} &middot; CL {num(slip.clDays)}
            </Fact>

            <Fact k="designation">{slip.designationName}</Fact>
            <Fact k="joinDate">{slip.dateOfJoining}</Fact>
            <Fact k="nhDays">{num(slip.nhDays)}</Fact>

            {/* Back among the facts. Below the signatures it was the only thing on a
                second page, with the whole of the first left blank under the totals. */}
            <Fact k="bankAcNo">{account}</Fact>
            <Fact k="otHours">{num(slip.otHours)}</Fact>
            <div className="slip-fact slip-fact-blank" />
          </section>

          <table className="slip-grid">
            <thead>
              <tr>
                <th><Label k="particulars" /></th>
                <th><Label k="actuals" /></th>
                <th><Label k="earnings" /></th>
                <th><Label k="deductionDetails" /></th>
                <th><Label k="amount" /></th>
              </tr>
            </thead>
            <tbody>
              <Line earn="basic" actual={slip.fixedBasic} earned={slip.earnedBasic}
                deduct="esi" amount={slip.esiEmployee} />
              <Line earn="da" actual={slip.fixedDa} earned={slip.earnedDa}
                deduct="pf" amount={slip.pfEmployee} />
              <Line earn="hra" actual={slip.fixedHra} earned={slip.earnedHra}
                deduct="profTax" amount={slip.professionalTax} />
              <Line earn="conveyance" actual={slip.fixedCa} earned={slip.earnedCa}
                deduct="lwf" amount={slip.lwf} />
              <Line earn="arrears" actual={slip.arrears} earned={slip.arrears}
                deduct="advance" amount={slip.advanceRecovery} />
              <Line earn="incentive" actual={slip.incentive} earned={slip.incentive}
                deduct="loan" amount={slip.loanRecovery} />
              {/* Washing allowance rides in Others, because the form has no line of its
                  own for it and a component printed nowhere would leave the earnings
                  column short of its own total. */}
              <Line earn="otherAllowance" actual={otherFixed} earned={otherEarned}
                deduct="otherDeductions" amount={slip.otherDeductions} />
              {/* Carried by the form, not by this payroll. Left as lines rather than
                  removed: Form 25B is a fixed layout and a short one is not that form. */}
              <Line earn="attdBonus" actual={null} earned={null}
                deduct="lateArrival" amount={null} />
              <Line earn="ot" actual={null} earned={slip.otAmount} deduct={null} />
            </tbody>
            <tfoot>
              <tr className="slip-total">
                <td><Label k="totalAmount" /></td>
                <td className="slip-figure">{money(slip.fixedGross)}</td>
                <td className="slip-figure">{money(slip.totalEarnings)}</td>
                <td><Label k="total" /></td>
                <td className="slip-figure">{money(slip.totalDeductions)}</td>
              </tr>
            </tfoot>
          </table>

          <section className="slip-summary">
            <div><span><Label k="grossSalary" /></span><strong>{money(slip.fixedGross)}</strong></div>
            <div><span><Label k="earnedSalary" /></span><strong>{money(slip.totalEarnings)}</strong></div>
            <div><span><Label k="deductions" /></span><strong>{money(slip.totalDeductions)}</strong></div>
            <div className="slip-net">
              <span><Label k="netAmount" /></span><strong>{money(slip.netSalary)}</strong>
            </div>
          </section>

          {/* No employer contributions and no cost to company. Form 25B is what the
              employee is handed, and what the company spends on top of their wage is
              not their business - it is the company's, and it is on its own screens. */}
          <footer className="slip-signatures">
            <div><Label k="employeeSignature" /></div>
            <div><Label k="managerSignature" /></div>
          </footer>
        </div>
  );

  return (
    <div className="salary-slip-print">
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }} className="no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={printSlip}>Print</Button>
      </div>

      {sheet()}
    </div>
  );
};

export default SalarySlipView;
