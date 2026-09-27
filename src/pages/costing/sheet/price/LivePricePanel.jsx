import { Alert, Card, Col, Divider, Row, Statistic, Typography } from 'antd';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { useSheet } from '../CostingSheetContext';
import CommercialInputs from './CommercialInputs';
import CostComposition from './CostComposition';

const { Text } = Typography;

// Statistic's precision cuts the decimals (20.4195 shows as 20.41); round first so the panel shows
// what the saved sheet will say.
const Tile = ({ title, value, currency, color, size = 15 }) => (
  <Statistic title={title} value={Math.round((Number(value) || 0) * 100) / 100} precision={2}
    prefix={getCurrencySymbol(currency)} styles={{ content: { fontSize: size, color } }} />
);

/**
 * The price as it is being built — every section total, the margins and the final quote —
 * sticky beside the sheet so a change anywhere shows its effect at once. It uses the server's
 * formulas and stored rates, so it equals what is saved.
 */
export default function LivePricePanel() {
  const { totals, header } = useSheet();
  const c = header.currency;
  const q = header.quoteCurrency;
  const showQuote = q && q !== c && q !== 'USD';
  const perDozen = header.pricingUnit === 'DOZEN';

  return (
    <Card size="small" className="sheet-price-panel" data-genie-anchor="price-panel"
      title={<Text strong style={{ color: '#10b981' }}>Live price</Text>}>
      <Row gutter={[12, 8]}>
        <Col span={12}><Tile title="Fabric Cost" value={totals.fabric} currency={c} color="var(--info-color)" /></Col>
        <Col span={12}><Tile title="Trims / Accessories" value={totals.accessories} currency={c} color="#8b5cf6" /></Col>
        <Col span={12}><Tile title="Manufacturing Cost" value={totals.manufacturing} currency={c} color="#f59e0b" /></Col>
        <Col span={12}><Tile title="Markup / Overhead" value={totals.markup} currency={c} color="#ef4444" /></Col>
      </Row>
      <CostComposition totals={totals} currency={c} isCmt={header.costingType === 'CMT'} />
      <Row gutter={[12, 8]} align="bottom">
        <Col span={12}><Tile title="Total Making Price" value={totals.making} currency={c} size={17} /></Col>
        <Col span={12}><Tile title="Overhead Charges" value={totals.charges} currency={c} color="var(--text-secondary)" /></Col>
      </Row>
      <Divider style={{ margin: '12px 0' }} />
      <CommercialInputs />
      <Divider style={{ margin: '12px 0' }} />
      <Card size="small" style={{ textAlign: 'center', borderColor: 'var(--primary-color)', marginBottom: 8 }}>
        <Text style={{ color: 'var(--primary-color)', fontSize: 12, display: 'block' }}>Total Price ({c})</Text>
        <Text style={{ color: 'var(--primary-color)', fontSize: 22, fontWeight: 800 }}>{getCurrencySymbol(c)} {totals.total.toFixed(2)}</Text>
      </Card>
      <Row gutter={8}>
        {showQuote && (
          <Col span={12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Final Price ({q})</Text>
              <Text strong style={{ fontSize: 18 }}>{getCurrencySymbol(q)} {totals.final.toFixed(2)}</Text>
            </Card>
          </Col>
        )}
        <Col span={showQuote ? 12 : 24}>
          <Card size="small" style={{ textAlign: 'center', borderColor: '#3b82f6' }}>
            <Text style={{ color: '#3b82f6', fontSize: 12, display: 'block' }}>Final Price (USD)</Text>
            <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 800 }}>$ {totals.usd.toFixed(2)}</Text>
          </Card>
        </Col>
      </Row>
      {perDozen && totals.total > 0 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Per piece: {getCurrencySymbol(c)} {(totals.total / 12).toFixed(2)} · $ {(totals.usd / 12).toFixed(2)} (÷12)
        </Text>
      )}
      <TargetCheck />
    </Card>
  );
}

function TargetCheck() {
  const { sheet, totals, header } = useSheet();
  const target = Number(sheet.commercial.targetPrice) || 0;
  if (!(target > 0) || !(totals.making > 0)) return null;
  const below = totals.making >= target;
  return (
    <Alert
      style={{ marginTop: 12 }}
      type={below ? 'error' : 'success'}
      showIcon
      title={below
        ? `Making price ${getCurrencySymbol(header.currency)} ${totals.making.toFixed(2)} is already at or above the target — no room for profit.`
        : `Target ${getCurrencySymbol(header.currency)} ${target.toFixed(2)} leaves ${totals.profitPct.toFixed(2)}% profit.`}
    />
  );
}
