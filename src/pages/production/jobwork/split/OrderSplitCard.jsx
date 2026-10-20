import { memo } from 'react';
import {
  Button, Card, Progress, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { isAfterDay } from '../../../../utils/jobWorkTracker/workingDays';
import { fmtDate, fmtQty, pct } from '../jwFormat';

const { Text } = Typography;
const PALETTE = ['#1677ff', '#722ed1', '#13c2c2', '#fa8c16', '#eb2f96'];
const INHOUSE = '#52c41a';

/** How the colour's quantity is shared between makers. */
const ShareBar = ({ rows, total }) => (
  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border-color, #f0f0f0)', margin: '6px 0 10px' }}>
    {rows.filter((r) => r.share > 0).map((r, i) => (
      <Tooltip key={r.key} title={`${r.maker}: ${fmtQty(r.share)}`}>
        <div style={{ width: `${(r.share / total) * 100}%`, background: r.inhouse ? INHOUSE : PALETTE[i % PALETTE.length] }} />
      </Tooltip>
    ))}
  </div>
);

const orderLevel = <Tooltip title="Counted for the whole order: hourly sewing records no colour"><Text type="secondary">order</Text></Tooltip>;

const columns = (shipDate, onOpenJob) => [
  {
    title: 'Maker', dataIndex: 'maker', width: 230,
    render: (v, r) => (r.inhouse ? <Text strong>In-house</Text> : (
      <><Text strong>{v}</Text><br /><Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onOpenJob(r.jobId)}>{r.jobNo}</Button></>
    )),
  },
  { title: 'Share', dataIndex: 'share', align: 'right', width: 90, render: fmtQty },
  { title: 'Cut', dataIndex: 'cut', align: 'right', width: 80, render: (v, r) => (r.inhouse ? orderLevel : fmtQty(v)) },
  { title: 'Stitched', dataIndex: 'sewn', align: 'right', width: 85, render: (v, r) => (r.inhouse ? orderLevel : fmtQty(v)) },
  { title: 'Packed', dataIndex: 'packed', align: 'right', width: 80, render: fmtQty },
  { title: 'Received / packed', dataIndex: 'received', width: 150, render: (v, r) => <Progress percent={pct(v, r.share)} size="small" format={() => fmtQty(v)} /> },
  { title: 'Pulled back', dataIndex: 'pulledBack', align: 'right', width: 100, render: (v) => (v ? <Tag color="purple">{fmtQty(v)}</Tag> : '—') },
  { title: 'Remaining', dataIndex: 'remaining', align: 'right', width: 95, render: fmtQty },
  {
    title: 'Forecast', dataIndex: 'forecast', width: 190,
    render: (d, r) => {
      if (!r.remaining) return <Tag color="green">Done</Tag>;
      if (!d) return <Text type="secondary">No pace yet</Text>;
      const late = isAfterDay(d, shipDate);
      return <Text type={late ? 'danger' : undefined}>{fmtDate(d)}{late ? ' — after ship date' : ''}</Text>;
    },
  },
];

/**
 * Split card (plan 1e): per colour, each vendor that makes the garment and in-house as one maker —
 * share, progress, pulled back, remaining and forecast against the ship date. At integration it sits on the Order view.
 */
const OrderSplitCard = memo(function OrderSplitCard({ split, onOpenJob }) {
  const { order, colours, inhouseOrderLevel } = split;
  const cols = columns(order.shipDate, onOpenJob);
  return (
    <Card size="small" title="Who makes what" extra={<Text type="secondary">Ship date {fmtDate(order.shipDate)}</Text>}>
      {colours.map((c) => {
        const total = Math.max(c.buyerQty, c.rows.reduce((a, r) => a + r.share, 0));
        return (
          <div key={c.colour} style={{ marginBottom: 16 }}>
            <Space size={12}><Text strong>{c.colour}</Text><Text type="secondary">Buyer qty {fmtQty(c.buyerQty)}</Text></Space>
            <ShareBar rows={c.rows} total={total} />
            <Table rowKey="key" size="small" pagination={false} columns={cols} dataSource={c.rows} scroll={{ x: 1100 }} />
          </div>
        );
      })}
      <Text type="secondary" style={{ fontSize: 12 }}>
        In-house ({inhouseOrderLevel.units.join(', ') || 'units from its POs'}) has cut {fmtQty(inhouseOrderLevel.cut)} and stitched {fmtQty(inhouseOrderLevel.sewn)} for the whole order;
        its packed figures are by colour. Its share is what the vendors no longer hold, so a pull-back moves pieces from a vendor row to in-house.
      </Text>
    </Card>
  );
});

export default OrderSplitCard;
