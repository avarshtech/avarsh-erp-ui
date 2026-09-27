import { Card, Checkbox, Col, Divider, InputNumber, Row, Tag, Typography } from 'antd';
import { formatCurrency } from '../../../../utils/costingConstants';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';

const { Text } = Typography;

function SizeInput({ size, field, label, value, step = 0.5 }) {
  const { dispatch } = useSheet();
  return (
    <div style={{ marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
      <InputNumber name={`${field}-${size}`} value={value} min={0} step={step} size="small" style={{ width: '100%' }} {...numericInputProps}
        onChange={(v) => dispatch({ type: 'SET_SIZE_OVERRIDE', size, patch: { [field]: v } })} />
    </div>
  );
}

/** Each size's cost and price when rows are split by size, with optional per-size margins. */
export default function PerSizePanel() {
  const { totals, header, sheet, dispatch } = useSheet();
  const { syncPercentages } = sheet.commercial;
  const c = header.currency;
  const span = Math.max(6, Math.floor(24 / totals.perSize.length));

  return (
    <>
      <Checkbox checked={syncPercentages} style={{ marginBottom: 12 }}
        onChange={(e) => dispatch({ type: 'SET_COMMERCIAL', patch: { syncPercentages: e.target.checked } })}>
        Apply the same agent % and profit % to every size
      </Checkbox>
      <Row gutter={[12, 12]}>
        {totals.perSize.map((p) => (
          <Col xs={24} sm={12} md={span} key={p.size}>
            <Card size="small" title={<Tag color="blue">{p.size}</Tag>}>
              <div style={{ fontSize: 12, lineHeight: '22px' }}>
                <div>Fabric: {formatCurrency(p.fabric, c)}</div>
                <div>Accessories: {formatCurrency(p.accessories, c)}</div>
                <div>Manufacturing: {formatCurrency(p.manufacturing, c)}</div>
                <div>Markup: {formatCurrency(p.markup, c)}</div>
                <Divider style={{ margin: '6px 0' }} />
                <Text strong>Making: {formatCurrency(p.making, c)}</Text>
              </div>
              {!syncPercentages && (
                <div style={{ marginTop: 8 }}>
                  <SizeInput size={p.size} field="agentCommissionPct" label="Agent %" value={p.agentPct} />
                  <SizeInput size={p.size} field="profitPct" label="Profit %" value={p.profitPct} />
                  <SizeInput size={p.size} field="targetPrice" label="Target Price" value={p.targetPrice} step={0.01} />
                </div>
              )}
              <Divider style={{ margin: '6px 0' }} />
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>$ {p.usd.toFixed(2)}</Text>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{getCurrencySymbol(c)} {p.total.toFixed(2)}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
