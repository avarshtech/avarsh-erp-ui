import { Button, InputNumber, Select, Space, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import ColorDot from '../../../components/ColorDot';
import { QtyCell, RateCell } from './CppGridCells';
import { billingQty, isKeyedBilling, lineAmount, round2 } from '../../../utils/jobWorkPoCalc';
import { jobWorkUomOptions } from '../../../utils/jobWorkConstants';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (title, render, width = 80) => ({ title, key: title, align: 'right', width, render });

/**
 * Lines grouped per requirement · colour · panel — one CPR line, so one process step — each
 * group a subtotal row (FR-17 colour subtotal) that also names the step.
 */
export const gridRows = (lines) => {
  const groups = new Map();
  lines.forEach((l) => {
    const key = `G|${l.cprId}|${l.colorName}|${l.panelName}`;
    const g = groups.get(key) || {
      key, isGroup: true, cprNo: l.cprNo, colorName: l.colorName, colorHex: l.colorHex, panelName: l.panelName,
      sequenceNo: l.sequenceNo, stepCount: l.stepCount, children: [],
    };
    g.children.push(l);
    groups.set(key, g);
  });
  return [...groups.values()].map((g) => ({
    ...g,
    required: g.children.reduce((s, l) => s + l.required, 0),
    prevPoQty: g.children.reduce((s, l) => s + l.prevPoQty, 0),
    poQty: g.children.reduce((s, l) => s + (Number(l.poQty) || 0), 0),
    amount: round2(g.children.reduce((s, l) => s + lineAmount(l), 0)),
  }));
};

/**
 * Grid columns (PRD §11.2): requirement columns read-only; PO qty, UOM, billing qty (keyed
 * units only) and rate editable per line until approval. `h` = { editable, balanceOf,
 * lastRateOf, overrideOf, canRequest, onPatch, onRequest, onRemove }.
 */
export const cppGridColumns = (h) => [
  {
    title: 'Colour · panel / size', key: 'label', width: 200, fixed: 'left',
    render: (_, r) => (r.isGroup ? (
      <Space size={6} align="start">
        <ColorDot hex={r.colorHex} />
        <span><strong>{r.colorName}</strong><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.panelName} · {r.cprNo} · step {r.sequenceNo} of {r.stepCount}</Text></span>
      </Space>
    ) : <span style={{ paddingLeft: 8 }}>{r.size}</span>),
  },
  num('Required', (_, r) => n(r.required)),
  num("Prev PO'd", (_, r) => n(r.prevPoQty)),
  num('Balance', (_, r) => (r.isGroup ? n(r.children.reduce((s, l) => s + h.balanceOf(l), 0)) : <strong>{n(h.balanceOf(r))}</strong>)),
  {
    title: 'PO Qty', key: 'poQty', width: 140,
    render: (_, r) => (r.isGroup ? <strong>{n(r.poQty)}</strong> : (
      <QtyCell line={r} balance={h.balanceOf(r)} editable={h.editable && h.balanceOf(r) + Number(r.poQty || 0) > 0}
        override={h.overrideOf(r)} canRequest={h.canRequest} onChange={(p) => h.onPatch(r.key, p)} onRequest={(excess) => h.onRequest(r, excess)} />
    )),
  },
  {
    title: 'UOM', key: 'uom', width: 96,
    render: (_, r) => (r.isGroup ? null : (
      <Select size="small" name={`uom-${r.key}`} aria-label="UOM" style={{ width: 84 }} disabled={!h.editable}
        options={jobWorkUomOptions('Cut Panel')} value={r.uom} onChange={(v) => h.onPatch(r.key, { uom: v, billingQty: null })} />
    )),
  },
  num('Billing Qty', (_, r) => {
    if (r.isGroup) return null;
    if (!isKeyedBilling(r.uom)) return n(billingQty(r));
    return (
      <InputNumber size="small" name={`billingQty-${r.key}`} aria-label="Billing quantity" min={0} precision={3} controls={false}
        style={{ width: 80 }} disabled={!h.editable} value={r.billingQty} status={r.billingQty == null ? 'warning' : undefined}
        onChange={(v) => h.onPatch(r.key, { billingQty: v })} {...numericInputProps} />
    );
  }, 96),
  {
    title: 'Rate ₹', key: 'rate', width: 140,
    render: (_, r) => (r.isGroup ? null : <RateCell line={r} lastRate={h.lastRateOf(r)} editable={h.editable && Number(r.poQty) > 0} onChange={(p) => h.onPatch(r.key, p)} />),
  },
  num('Last Rate', (_, r) => (r.isGroup ? null : (h.lastRateOf(r) ? `₹${money(h.lastRateOf(r))}` : '—')), 84),
  num('Amount ₹', (_, r) => (r.isGroup ? <strong>{money(r.amount)}</strong> : money(lineAmount(r))), 104),
  ...(h.onRemove ? [{
    title: '', key: 'remove', width: 40, fixed: 'right',
    render: (_, r) => (r.isGroup ? null : <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Remove ${r.colorName} ${r.size}`} onClick={() => h.onRemove(r.key)} />),
  }] : []),
];
