import { useState, useEffect, useCallback } from 'react';
import { Button, Spin } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSalarySlip } from '../../../services/hr/payrollService';
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

/** A figure, or a dash. The form uses "-" for a line that does not apply. */
const money = (v) => (v == null || Number(v) === 0
  ? '-'
  : formatAmount(v, { minDecimals: 2, empty: '-' }));

/** Days and hours read as 22.5, not 22.50. */
const num = (v) => (v == null ? '-' : String(Number(v)));

/** A label in both languages, stacked. */
const Label = ({ k }) => (
  <>
    <span className="slip-en">{L[k].en}</span>
    <span className="slip-ta">{L[k].ta}</span>
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

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  if (!slip) return null;

  const period = `${MONTH_SHORT[(slip.month || 1) - 1]}-${slip.year}`;
  // Only the last four digits. The account number is encrypted at rest and this sheet
  // is printed and carried around a factory.
  const account = slip.accountNumber
    ? `XXXX${String(slip.accountNumber).slice(-4)}`
    : '-';

  return (
    <div className="salary-slip-print">
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }} className="no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
      </div>

      <div className="slip-sheet">
        <header className="slip-head">
          <div className="slip-company">{slip.unitName}</div>
          <div className="slip-title">
            <Label k="payslip" /> <span className="slip-form-no">{L.formNo.en}</span>
          </div>
          <div className="slip-period">
            <Label k="salaryMonth" /> <strong>{period}</strong>
          </div>
        </header>

        <section className="slip-facts">
          <Fact k="name">{slip.employeeName}</Fact>
          <Fact k="pfNo">{slip.pfNumber}</Fact>
          <Fact k="fatherHusbandName">{slip.fatherHusbandName}</Fact>
          <Fact k="joinDate">{slip.dateOfJoining}</Fact>
          <Fact k="dept">{slip.departmentName}</Fact>
          <Fact k="esiNo">{slip.esiNumber}</Fact>
          <Fact k="designation">{slip.designationName}</Fact>
          <Fact k="lopDays">{num(slip.lopDays)}</Fact>
          <Fact k="idNo">{slip.employeeNo}</Fact>
          <Fact k="otHours">{num(slip.otHours)}</Fact>
          {/* Out of the wage-days basis, which is the whole reason the days add up
              to 26 and not to the length of the month. */}
          <Fact k="earnDays">
            {num(slip.payableDays)}
            {slip.wageDaysBasis != null && (
              <span className="slip-of"> / {num(slip.wageDaysBasis)}</span>
            )}
          </Fact>
          <Fact k="bankAcNo">{account}</Fact>
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
            <Line earn="washing" actual={slip.fixedWa} earned={slip.earnedWa}
              deduct="advance" amount={slip.advanceRecovery} />
            <Line earn="otherAllowance" actual={slip.fixedOther} earned={slip.earnedOther}
              deduct="loan" amount={slip.loanRecovery} />
            <Line earn="arrears" actual={slip.arrears} earned={slip.arrears}
              deduct="tds" amount={slip.tds} />
            <Line earn="incentive" actual={slip.incentive} earned={slip.incentive}
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

        {/* Not deducted from anybody's pay, so it sits apart from the grid. */}
        <section className="slip-employer">
          <div className="slip-employer-title"><Label k="employerContributions" /></div>
          <div><span><Label k="pfEmployer" /></span><span>{money(slip.pfEmployer)}</span></div>
          <div><span><Label k="esiEmployer" /></span><span>{money(slip.esiEmployer)}</span></div>
          <div><span><Label k="costToCompany" /></span>
            <span>{money(
              Number(slip.totalEarnings || 0)
              + Number(slip.pfEmployer || 0)
              + Number(slip.esiEmployer || 0),
            )}</span>
          </div>
        </section>

        <footer className="slip-signatures">
          <div><Label k="employeeSignature" /></div>
          <div><Label k="managerSignature" /></div>
        </footer>
      </div>
    </div>
  );
};

export default SalarySlipView;
