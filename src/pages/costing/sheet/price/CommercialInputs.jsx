import { Col, InputNumber, Row, Typography } from 'antd';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';

const { Text } = Typography;

function Field({ label, children }) {
  return (
    <Col span={8}>
      <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>{label}</Text></div>
      {children}
    </Col>
  );
}

/**
 * Agent commission, profit and target price. A target price drives the profit % (shown in the
 * profit field); typing a profit % clears the target.
 */
export default function CommercialInputs() {
  const { sheet, dispatch, totals, header } = useSheet();
  const { commercial } = sheet;
  const set = (patch) => dispatch({ type: 'SET_COMMERCIAL', patch });

  return (
    <Row gutter={8} align="bottom" data-genie-anchor="commercials">
      <Field label="Agent Commission %">
        <InputNumber name="agentCommissionPct" value={commercial.agentCommissionPct} min={0} max={100} step={0.5}
          style={{ width: '100%' }} suffix="%" onChange={(v) => set({ agentCommissionPct: v })} {...numericInputProps} />
      </Field>
      <Field label="Profit %">
        <InputNumber name="profitPct" value={totals.profitPct} min={0} max={100} step={0.5}
          style={{ width: '100%' }} suffix="%" onChange={(v) => set({ profitPct: v, targetPrice: '' })} {...numericInputProps} />
      </Field>
      <Field label={`Target (${getCurrencySymbol(header.currency)})`}>
        <InputNumber name="targetPrice" value={commercial.targetPrice} min={0} step={0.01} placeholder="Optional"
          style={{ width: '100%' }} onChange={(v) => set({ targetPrice: v })} {...numericInputProps} />
      </Field>
    </Row>
  );
}
