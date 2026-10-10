import { InputNumber, Space, Tag } from 'antd';
import { formatCurrency, formatNumber } from '../../../../utils/formatters';
import { toUnits } from '../../../../utils/jobWorkBillCalc';

const pcs = (v) => (v ? formatNumber(v) : <span style={{ color: 'var(--text-secondary)' }}>0</span>);
export const lineLabel = (l) => [l.orderNo, l.color, l.panel, l.size].filter(Boolean).join(' · ');

const flagsOf = (l) => [
  l.invoiceRate > l.poRate && <Tag key="rate" color="orange">Rate above PO</Tag>,
  l.passedPcs > l.acceptedQty && <Tag key="paid" color="red">Paying rejects</Tag>,
  l.invoiceUnits < l.passedUnits && <Tag key="short" color="gold">Invoiced &lt; accepted</Tag>,
  l.recoverableRejectQty > 0 && <Tag key="dmg">{`Recover ${l.recoverableRejectQty} pcs`}</Tag>,
  l.recoverableShortQty > 0 && <Tag key="sht">{`Short ${l.recoverableShortQty} pcs`}</Tag>,
].filter(Boolean);

/**
 * The reconciliation-and-passing grid: what the PO asked for and what came back (pieces), then the vendor's
 * invoice and what is passed (the PO's billing unit). Unkeyed figures follow their defaults — returned qty,
 * the PO rate, what QC accepted.
 */
export const jwbLineColumns = ({ bill, readOnly, onLineChange }) => {
  const showShort = bill.poStatus === 'CLOSED';
  const showAllowance = bill.lines.some((l) => l.allowanceQty > 0);
  const edit = (field, l, opts) => (readOnly ? formatNumber(l[field], field === 'invoiceRate' ? 2 : (opts.precision ?? 0)) : (
    <InputNumber
      name={`${field}-${l.id}`}
      size="small"
      min={0}
      style={{ width: 104 }}
      disabled={readOnly}
      value={l[field]}
      onChange={(v) => onLineChange(l.id, field, v)}
      {...opts}
    />
  ));
  return [
    { title: 'Line', key: 'line', fixed: 'left', render: (_, l) => <strong>{lineLabel(l)}</strong> },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', align: 'center' },
    { title: 'PO Qty', dataIndex: 'poQty', key: 'poQty', align: 'right', render: pcs },
    { title: 'Issued', dataIndex: 'issuedQty', key: 'issuedQty', align: 'right', render: pcs },
    { title: 'Returned', dataIndex: 'returnedQty', key: 'returnedQty', align: 'right', render: pcs },
    { title: 'Rej. Receipt', dataIndex: 'rejectedReceiptQty', key: 'rejectedReceiptQty', align: 'right', render: pcs },
    { title: 'Rej. Check', dataIndex: 'rejectedQcQty', key: 'rejectedQcQty', align: 'right', render: pcs },
    { title: 'Accepted', dataIndex: 'acceptedQty', key: 'acceptedQty', align: 'right', render: (v) => <strong>{formatNumber(v)}</strong> },
    ...(showShort ? [{ title: 'Never Returned', dataIndex: 'shortQty', key: 'shortQty', align: 'right', render: pcs }] : []),
    ...(showAllowance ? [{ title: 'Loss Allowance', key: 'allow', align: 'right', render: (_, l) => `${formatNumber(l.allowanceUsed)} / ${formatNumber(Math.floor(l.allowanceQty))}` }] : []),
    { title: 'Invoice Qty', key: 'invoiceUnits', align: 'center', render: (_, l) => edit('invoiceUnits', l, { precision: l.uom === 'PIECE' ? 0 : 3 }) },
    { title: 'Invoice Rate', key: 'invoiceRate', align: 'center', render: (_, l) => edit('invoiceRate', l, { step: 0.01 }) },
    { title: 'PO Rate', dataIndex: 'poRate', key: 'poRate', align: 'right', render: (v) => formatNumber(v, 2) },
    {
      title: 'Passed Qty',
      key: 'passedUnits',
      align: 'center',
      render: (_, l) => edit('passedUnits', l, { precision: l.uom === 'PIECE' ? 0 : 3, max: toUnits(l.returnedQty, l) }),
    },
    { title: 'Invoiced ₹', dataIndex: 'invoiceAmount', key: 'invoiceAmount', align: 'right', render: (v) => formatCurrency(v) },
    { title: 'Passed ₹', dataIndex: 'passedAmount', key: 'passedAmount', align: 'right', render: (v) => <strong>{formatCurrency(v)}</strong> },
    { title: 'Flags', key: 'flags', render: (_, l) => <Space size={4}>{flagsOf(l)}</Space> },
  ];
};

