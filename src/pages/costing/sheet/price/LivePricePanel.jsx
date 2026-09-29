import { useState } from 'react';
import { Card, Col, Divider, Row, Statistic, Typography } from 'antd';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { useSheet } from '../CostingSheetContext';
import CommercialInputs from './CommercialInputs';
import CostComposition from './CostComposition';
import SizePicker from './SizePicker';
import TargetCheck from './TargetCheck';

const { Text } = Typography;

// Statistic's precision cuts the decimals (20.4195 shows as 20.41); round first so the panel shows
// what the saved sheet will say.
const Tile = ({ title, value, currency, color, size = 15 }) => (
  <Statistic title={title} value={Math.round((Number(value) || 0) * 100) / 100} precision={2}
    prefix={getCurrencySymbol(currency)} styles={{ content: { fontSize: size, color } }} />
);

/**
 * The price as it is being built — every section total, the margins and the final quote —
 * floating beside the sheet so a change anywhere shows its effect at once. When rows are limited
 * to some sizes it prices one size at a time (the server saves the same per-size figures);
 * otherwise the whole garment. It uses the server's formulas and stored rates.
 */
export default function LivePricePanel() {
  const { totals, header } = useSheet();
  const [picked, setPicked] = useState(null);
  const size = totals.perSize.find((p) => p.size === picked) || totals.perSize[0] || null;
  const view = size || totals;
  const c = header.currency;
  const q = header.quoteCurrency;
  const showQuote = q && q !== c && q !== 'USD';
  const perDozen = header.pricingUnit === 'DOZEN';
  const ownMargins = size && (size.agentPct !== totals.agentPct || size.profitPct !== totals.profitPct);

  return (
    <Card size="small" className="sheet-price-panel" data-genie-anchor="price-panel"
      title={<Text strong style={{ color: '#10b981' }}>Live price{size ? ` — size ${size.size}` : ''}</Text>}>
      {size && <SizePicker sizes={totals.perSize} value={size.size} onChange={setPicked} />}
      <Row gutter={[12, 8]}>
        <Col span={12}><Tile title="Fabric Cost" value={view.fabric} currency={c} color="var(--info-color)" /></Col>
        <Col span={12}><Tile title="Trims / Accessories" value={view.accessories} currency={c} color="#8b5cf6" /></Col>
        <Col span={12}><Tile title="Manufacturing Cost" value={view.manufacturing} currency={c} color="#f59e0b" /></Col>
        <Col span={12}><Tile title="Markup / Overhead" value={view.markup} currency={c} color="#ef4444" /></Col>
      </Row>
      <CostComposition totals={view} currency={c} isCmt={header.costingType === 'CMT'} />
      <Row gutter={[12, 8]} align="bottom">
        <Col span={12}><Tile title="Total Making Price" value={view.making} currency={c} size={17} /></Col>
        <Col span={12}><Tile title="Overhead Charges" value={view.charges} currency={c} color="var(--text-secondary)" /></Col>
      </Row>
      <Divider style={{ margin: '12px 0' }} />
      <CommercialInputs />
      {ownMargins && (
        <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          Size {size.size} uses agent {size.agentPct}% · profit {size.profitPct}% (set in Section F).
        </Text>
      )}
      <Divider style={{ margin: '12px 0' }} />
      <Card size="small" style={{ textAlign: 'center', borderColor: 'var(--primary-color)', marginBottom: 8 }}>
        <Text style={{ color: 'var(--primary-color)', fontSize: 12, display: 'block' }}>Total Price ({c})</Text>
        <Text style={{ color: 'var(--primary-color)', fontSize: 22, fontWeight: 800 }}>{getCurrencySymbol(c)} {view.total.toFixed(2)}</Text>
      </Card>
      <Row gutter={8}>
        {showQuote && (
          <Col span={12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Final Price ({q})</Text>
              <Text strong style={{ fontSize: 18 }}>{getCurrencySymbol(q)} {view.final.toFixed(2)}</Text>
            </Card>
          </Col>
        )}
        <Col span={showQuote ? 12 : 24}>
          <Card size="small" style={{ textAlign: 'center', borderColor: '#3b82f6' }}>
            <Text style={{ color: '#3b82f6', fontSize: 12, display: 'block' }}>Final Price (USD)</Text>
            <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 800 }}>$ {view.usd.toFixed(2)}</Text>
          </Card>
        </Col>
      </Row>
      {perDozen && view.total > 0 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Per piece: {getCurrencySymbol(c)} {(view.total / 12).toFixed(2)} · $ {(view.usd / 12).toFixed(2)} (÷12)
        </Text>
      )}
      <TargetCheck view={view} size={size?.size} />
    </Card>
  );
}
