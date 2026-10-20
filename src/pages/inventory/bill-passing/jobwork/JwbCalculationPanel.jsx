import { Col, InputNumber, Row, Typography } from 'antd';
import { CalculatorOutlined, CheckCircleFilled, WarningFilled } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import { formatCurrency } from '../../../../utils/formatters';

const { Text } = Typography;
const ROW = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-color)' };
const HEAD = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 4 };

const Line = ({ label, value, strong, tone, children }) => (
  <div style={ROW}>
    <Text style={{ color: 'var(--text-secondary)' }}>{label}</Text>
    {children || <Text strong={strong} style={tone ? { color: tone } : undefined}>{value}</Text>}
  </div>
);

const money = (name, value, onChange, readOnly) => (readOnly ? <Text>{formatCurrency(value)}</Text> : (
  <InputNumber name={name} size="small" precision={2} style={{ width: 140 }} prefix="₹" value={value} onChange={(v) => onChange(v ?? 0)} />
));

/**
 * The money: the vendor's invoice as he billed it (other charges, GST and round-off keyed as printed), what is
 * passed, and the debit note that bridges the two. Net payable = invoice total − debit note.
 */
const JwbCalculationPanel = ({ bill, readOnly, onChange }) => {
  const g = bill.gstComputed;
  const reconciled = Math.round((bill.linesInvoice - bill.rejectionAmount - bill.rateDiffAmount - bill.passedAmount) * 100) === 0;
  const gstRows = bill.igstApplicable
    ? [['IGST', 'invoiceIgst', g.igst]]
    : [['CGST', 'invoiceCgst', g.cgst], ['SGST', 'invoiceSgst', g.sgst]];
  return (
    <DetailCard title="Calculation" icon={<CalculatorOutlined />} bare style={{ marginBottom: 16 }}>
      <Row gutter={[32, 16]}>
        <Col xs={24} lg={12}>
          <div style={HEAD}>Vendor invoice</div>
          <Line label="Lines invoiced" value={formatCurrency(bill.linesInvoice)} />
          <Line label="Other charges">{money('otherCharges', bill.otherCharges, (v) => onChange({ otherCharges: v }), readOnly)}</Line>
          <Line label="Taxable value" value={formatCurrency(bill.invoiceTaxable)} strong />
          {gstRows.map(([label, key, computed]) => (
            <Line key={key} label={`${label} as invoiced (${formatCurrency(computed)} at ${bill.igstApplicable ? bill.gstRatePercent : bill.gstRatePercent / 2}%)`}>
              {money(key, bill[key], (v) => onChange({ [key]: v }), readOnly)}
            </Line>
          ))}
          <Line label="Round off">{money('invoiceRoundOff', bill.invoiceRoundOff, (v) => onChange({ invoiceRoundOff: v }), readOnly)}</Line>
          <Line label="Invoice total" value={formatCurrency(bill.invoiceTotal)} strong />
        </Col>
        <Col xs={24} lg={12}>
          <div style={HEAD}>Passing</div>
          <Line label="Passed (accepted × PO rate)" value={formatCurrency(bill.passedAmount)} strong />
          <Line label="Rejected / short qty he billed" value={formatCurrency(bill.rejectionAmount)} />
          <Line label="Rate above PO" value={formatCurrency(bill.rateDiffAmount)} />
          <Line label="Lines invoiced − both = passed">
            {reconciled
              ? <Text style={{ color: 'var(--success-color)' }}><CheckCircleFilled /> Reconciled</Text>
              : <Text style={{ color: 'var(--error-color)' }}><WarningFilled /> Does not reconcile</Text>}
          </Line>
          <Line label={`Debit note (${formatCurrency(bill.deductionTotal)} + GST ${formatCurrency(bill.deductionGst)})`} value={`− ${formatCurrency(bill.debitNoteTotal)}`} tone="var(--warning-color)" />
          <Line label="Net payable" value={formatCurrency(bill.netPayable)} strong tone="var(--primary-color)" />
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            TDS (194C) is deducted in Tally at payment. Deductions count only once confirmed.
          </Text>
        </Col>
      </Row>
    </DetailCard>
  );
};

export default JwbCalculationPanel;
