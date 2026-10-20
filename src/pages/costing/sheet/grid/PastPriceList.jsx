import { Button, Divider, Empty, Flex, Spin, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const day = (d) => (d ? dayjs(d).format('DD MMM YY') : '');

/**
 * What a material last cost: its latest costing, then up to ten recent PO prices. A price is
 * offered for "Use" only in the rate cell's own currency — PO prices are in rupees, and dropping a
 * rupee figure into a USD cell would be a silent error.
 */
export default function PastPriceList({ prices, rateCurrency, onUse }) {
  if (prices === undefined) return <Spin size="small" />;
  const { po = [], costing = null } = prices;
  if (!po.length && !costing) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not bought on a PO or costed yet" />;
  const poUsable = rateCurrency === 'INR';

  return (
    <Flex vertical gap={6} style={{ width: 300 }}>
      {costing && (
        <Flex justify="space-between" align="center" gap={8}>
          <div>
            <Text strong>{costing.currency === 'USD' ? '$' : '₹'} {costing.price.toFixed(2)}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Last costed · {costing.costingId} · {day(costing.date)}</Text></div>
          </div>
          {costing.currency === rateCurrency && <Button size="small" type="link" onClick={() => onUse(costing.price)}>Use</Button>}
        </Flex>
      )}
      {costing && po.length > 0 && <Divider style={{ margin: '2px 0' }} />}
      {po.length > 0 && !poUsable && <Text type="secondary" style={{ fontSize: 12 }}>PO prices are in INR; this rate is in {rateCurrency}.</Text>}
      {po.map((p) => (
        <Flex key={`${p.poNo}-${p.price}`} justify="space-between" align="center" gap={8}>
          <div>
            <Text strong>₹ {Number(p.price).toFixed(2)}{p.uomSymbol ? ` /${p.uomSymbol}` : ''}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{p.vendor} · {p.poNo} · {day(p.date)}</Text></div>
          </div>
          {poUsable && <Button size="small" type="link" onClick={() => onUse(Number(p.price))}>Use</Button>}
        </Flex>
      ))}
      {!po.length && <Text type="secondary" style={{ fontSize: 12 }}>Not bought on a PO yet.</Text>}
    </Flex>
  );
}
