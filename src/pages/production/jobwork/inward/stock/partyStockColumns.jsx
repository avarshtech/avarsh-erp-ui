import {
  Button, Space, Tag, Tooltip, Typography,
} from 'antd';
import { WASTE_RULE, WASTE_RULE_LABEL } from '../../../../../utils/jobWorkInward/inwardConstants';
import { AgeTag, JobOrderStatusTag } from '../components/InwardTags';
import { fmtDate, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const uomText = (list) => (list?.length ? list.map((x) => `${fmtQty(x.qty)} ${x.uom}`).join(' · ') : '—');
const lotOnly = (render) => (v, r) => (r.row === 'LOT' ? render(v, r) : null);

/** Columns of the party stock tree (principal → job order → lot). */
const partyStockColumns = ({ onOpenJob, onIssue, onMove, onWriteOff, onSellWaste, can }) => [
  {
    title: 'Principal / job order / lot', key: 'name', width: 330, fixed: 'left',
    render: (_, r) => {
      if (r.row === 'PRINCIPAL') return <Space size={6}><Text strong>{r.name}</Text><Tag>{WASTE_RULE_LABEL[r.wasteRule]}</Tag></Space>;
      if (r.row === 'ORDER') return <Space size={6} wrap><Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenJob(r.id)}>{r.orderNo}</Button><Text type="secondary">{r.styleNo}</Text><JobOrderStatusTag status={r.status} /></Space>;
      return (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}><Text strong>{r.lotNo}</Text> · {r.itemName}{r.size ? ` — ${r.size}` : ''}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.rolls ? `${r.rolls.length} rolls · ` : ''}{r.location}{r.origin ? ` · moved in (${r.origin.docNo})` : ''}</Text>
        </Space>
      );
    },
  },
  { title: 'In store', key: 'store', width: 150, align: 'right', render: (_, r) => (r.row === 'LOT' ? <Text strong>{fmtQty(r.ledger.inStore)} {r.uom}</Text> : uomText(r.inStore)) },
  {
    title: <Tooltip title="In store plus what went into production and is not yet back as garments (pieces × agreed consumption).">Not yet accounted</Tooltip>, key: 'acc', width: 170, align: 'right',
    render: (_, r) => (r.row === 'LOT' ? `${fmtQty(r.outstanding)} ${r.uom}` : uomText(r.outstanding)),
  },
  { title: 'Age', key: 'age', width: 120, render: lotOnly((_, r) => (r.ageLevel ? <AgeTag level={r.ageLevel} days={r.ageDays} /> : <Text type="secondary">{r.ageDays} days</Text>)) },
  { title: 'Their challan', key: 'dc', width: 150, render: lotOnly((_, r) => <>{r.theirDcNo}<br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)}</Text></>) },
  { title: 'Received', key: 'rcv', width: 110, align: 'right', render: lotOnly((_, r) => `${fmtQty(r.receivedQty)} ${r.uom}`) },
  {
    title: 'Into production', key: 'prod', width: 140, align: 'right',
    render: lotOnly((_, r) => (
      <>{fmtQty(r.ledger.consumable)}{r.ledger.atVendor > 0 && <Tooltip title="Sent to our process vendor and not back yet."><Tag color="purple" style={{ marginLeft: 4 }}>{fmtQty(r.ledger.atVendor)} at vendor</Tag></Tooltip>}</>
    )),
  },
  { title: 'Returned · written off · moved', key: 'out', width: 170, align: 'right', render: lotOnly((_, r) => `${fmtQty(r.ledger.returned)} · ${fmtQty(r.ledger.writtenOff)} · ${fmtQty(r.ledger.movedOut)}`) },
  {
    title: '', key: 'act', width: 230, fixed: 'right',
    render: (_, r) => {
      if (r.row === 'ORDER') {
        if (r.wasteOnHand <= 0) return null;
        return r.wasteRule === WASTE_RULE.SELL
          ? <Button size="small" disabled={!can.receive} onClick={() => onSellWaste(r)}>Sell {fmtQty(r.wasteOnHand)} kg waste</Button>
          : <Text type="secondary" style={{ fontSize: 12 }}>{fmtQty(r.wasteOnHand)} kg waste held — goes back on a return</Text>;
      }
      if (r.row !== 'LOT' || r.ledger.inStore <= 0) return null;
      return (
        <Space size={4}>
          <Button size="small" color="primary" variant="outlined" disabled={!can.add} onClick={() => onIssue(r)}>Issue</Button>
          <Button size="small" disabled={!can.add} onClick={() => onMove(r)}>Move</Button>
          <Button size="small" danger disabled={!can.cancel} onClick={() => onWriteOff(r)}>Write off</Button>
        </Space>
      );
    },
  },
];

export default partyStockColumns;
