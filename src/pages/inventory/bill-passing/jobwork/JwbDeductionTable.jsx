import { useMemo } from 'react';
import { Space, Table, Tag, Typography } from 'antd';
import { MinusCircleOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import { ActionButton } from '../../../../components/buttons';
import { formatCurrency, formatNumber } from '../../../../utils/formatters';
import { DEBIT_STATUS_COLOR } from '../../../../utils/billPassingConstants';
import { JW_DEDUCTION_TYPES, uomShort } from '../../../../utils/jobWorkBillConstants';
import { lineLabel } from './jwbLineColumns';

const { Text } = Typography;

/**
 * The Vendor Debit Note's lines. "Propose deductions" reads the bill as saved and proposes from it; the
 * verifier keys recovery rates, confirms or drops each proposal, and adds penalties by hand. Only confirmed
 * rows reach the debit note.
 */
const JwbDeductionTable = ({ bill, readOnly, busyProps, dirty, onPropose, onAdd, onEdit, onConfirm, onDrop, onDelete }) => {
  const lineById = useMemo(() => new Map(bill.lines.map((l) => [l.id, l])), [bill.lines]);
  const columns = useMemo(() => [
    { title: 'Deduction', dataIndex: 'type', key: 'type', fixed: 'left', render: (t) => <strong>{JW_DEDUCTION_TYPES[t]?.label || t}</strong> },
    { title: 'Against', dataIndex: 'lineId', key: 'lineId', render: (id) => (id ? lineLabel(lineById.get(id) || {}) : 'Whole bill') },
    {
      title: 'Qty', key: 'qty', align: 'right',
      render: (_, d) => {
        if (d.qty == null) return '—';
        const uom = JW_DEDUCTION_TYPES[d.type]?.basis === 'PCS' ? 'PIECE' : lineById.get(d.lineId)?.uom;
        return `${formatNumber(d.qty, uom === 'PIECE' ? 0 : 3)} ${uomShort(uom)}`;
      },
    },
    {
      title: 'Rate', key: 'rate', align: 'right',
      render: (_, d) => {
        if (d.rate == null) return '—';
        if (!d.rate && JW_DEDUCTION_TYPES[d.type]?.keyedRate) return <Tag color="warning">Key the rate</Tag>;
        return formatNumber(d.rate, 2);
      },
    },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v) => formatCurrency(v) },
    { title: 'GST', dataIndex: 'gstAmount', key: 'gstAmount', align: 'right', render: (v, d) => (d.gstTreatment === 'WITH_GST' ? formatCurrency(v) : 'No GST') },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'Origin', dataIndex: 'origin', key: 'origin', render: (o) => <Tag>{o === 'MANUAL' ? 'Manual' : 'Proposed'}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', align: 'center', render: (s) => <Tag color={DEBIT_STATUS_COLOR[s]}>{s.charAt(0) + s.slice(1).toLowerCase()}</Tag> },
    ...(readOnly ? [] : [{
      title: 'Actions', key: 'actions', fixed: 'right', align: 'center',
      render: (_, d) => (
        <Space size={4}>
          <ActionButton action="edit" size="small" {...busyProps(`edit-${d.id}`)} onClick={() => onEdit(d)} />
          {d.status !== 'CONFIRMED' && <ActionButton action="approve" size="small" tooltip="Confirm" {...busyProps(`confirm-${d.id}`)} onClick={() => onConfirm(d)} />}
          {d.status !== 'DROPPED' && <ActionButton action="reject" size="small" tooltip="Drop" {...busyProps(`drop-${d.id}`)} onClick={() => onDrop(d)} />}
          {d.origin === 'MANUAL' && <ActionButton action="delete" size="small" {...busyProps(`delete-${d.id}`)} onClick={() => onDelete(d)} />}
        </Space>
      ),
    }]),
  ], [lineById, readOnly, busyProps, onEdit, onConfirm, onDrop, onDelete]);

  const extra = readOnly ? null : (
    <Space wrap>
      <ActionButton action="refresh" text="Propose deductions" tooltip={dirty ? 'Saves the bill first, then proposes from it' : undefined}
        {...busyProps('propose')} onClick={onPropose} />
      <ActionButton action="create" text="Add deduction" variant="draft" {...busyProps('add')} onClick={onAdd} />
    </Space>
  );

  return (
    <DetailCard title="Debit Note — Deductions" icon={<MinusCircleOutlined />} count={bill.deductions.length} extra={extra} bare style={{ marginBottom: 16 }}>
      <Table size="small" className="table-nowrap" rowKey="id" columns={columns} dataSource={bill.deductions}
        pagination={false} scroll={{ x: 'max-content' }}
        locale={{ emptyText: readOnly ? 'No deductions on this bill' : 'Nothing proposed yet — Propose deductions reads the lines above' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
        {bill.vdnNumber && <Text>Debit note <strong>{bill.vdnNumber}</strong>{bill.vdnRevision > 1 ? ` (revision ${bill.vdnRevision})` : ''}</Text>}
        <Text>Confirmed {formatCurrency(bill.deductionTotal)} + GST {formatCurrency(bill.deductionGst)} = <strong>{formatCurrency(bill.debitNoteTotal)}</strong></Text>
      </div>
    </DetailCard>
  );
};

export default JwbDeductionTable;
