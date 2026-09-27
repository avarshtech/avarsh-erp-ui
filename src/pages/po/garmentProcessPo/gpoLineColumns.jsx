import { Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import ColorDot from '../../../components/ColorDot';
import { GpoQtyCell, GpoRateCell, GpoUomCell } from './GpoLineCells';
import { lineAmount } from '../../../utils/jobWorkPoCalc';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LOCKED = { style: { background: 'var(--bg-secondary, rgba(0, 0, 0, 0.03))' } };
const locked = (col) => ({ ...col, onCell: () => LOCKED });
const num = (title, dataIndex, width = 80) => locked({ title, dataIndex, key: title, align: 'right', width, render: n });

/**
 * Line columns (PRD §8.2, §19): requirement columns locked and tinted; PO qty, UOM and rate
 * editable until submission. The requirement number stays pinned left and the amount right
 * while the rest scrolls. `h` = { editable, balanceOf, excessOf, lastRateOf, canRequest,
 * onPatch, onRequest, onRemove }.
 */
export const gpoLineColumns = (h) => [
  locked({ title: '#', key: 'n', width: 40, fixed: 'left', render: (_, l, i) => i + 1 }),
  locked({ title: 'Req No.', dataIndex: 'gprNo', width: 132, fixed: 'left' }),
  locked({ title: 'Order', dataIndex: 'orderNo', width: 124 }),
  locked({ title: 'Style', dataIndex: 'styleNo', width: 84 }),
  locked({ title: 'Colour', dataIndex: 'color', width: 104, render: (v, l) => <span><ColorDot hex={l.colorHex} /> {v}</span> }),
  locked({ title: 'Size', dataIndex: 'size', width: 64 }),
  locked({ title: 'Seq', dataIndex: 'seqNo', width: 48, align: 'center' }),
  locked({ title: 'Process', dataIndex: 'processLabel', width: 130 }),
  num('Required', 'required'),
  num('Prev PO', 'prevPoQty', 76),
  locked({ title: 'Balance', key: 'balance', align: 'right', width: 80, render: (_, l) => <strong>{n(h.balanceOf(l))}</strong> }),
  {
    title: 'PO Qty *', key: 'poQty', width: 150,
    render: (_, l) => <GpoQtyCell line={l} balance={h.balanceOf(l)} editable={h.editable} excess={h.excessOf(l)} canRequest={h.canRequest}
      onChange={(p) => h.onPatch(l.key, p)} onRequest={(over) => h.onRequest(l, over)} />,
  },
  { title: 'UOM *', key: 'uom', width: 100, render: (_, l) => <GpoUomCell line={l} editable={h.editable} onChange={(p) => h.onPatch(l.key, p)} /> },
  { title: 'Rate ₹ *', key: 'rate', width: 124, render: (_, l) => <GpoRateCell line={l} lastRate={h.lastRateOf(l)} editable={h.editable} onChange={(p) => h.onPatch(l.key, p)} /> },
  { title: 'Amount ₹', key: 'amount', align: 'right', width: 110, fixed: 'right', render: (_, l) => money(lineAmount(l)) },
  ...(h.onRemove ? [{
    title: '', key: 'remove', width: 40, fixed: 'right',
    render: (_, l) => <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Remove ${l.gprNo} ${l.color} ${l.size}`} onClick={() => h.onRemove(l.key)} />,
  }] : []),
];
