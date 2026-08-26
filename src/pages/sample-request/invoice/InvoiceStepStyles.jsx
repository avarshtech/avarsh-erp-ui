import { useMemo } from 'react';
import { Table, Checkbox, Tag, Typography, Alert } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { SR_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getSrStatusLabel } from '../../../utils/sampleRequestConstants';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

/**
 * Step 1 — style selection (PRD §10.3). Eligible = In Production or later,
 * not covered by an issued invoice, not already dispatched. Ineligible rows
 * are greyed with the reason shown; consignee + destination must match across
 * every line of one invoice.
 */
const InvoiceStepStyles = ({ eligible, selectedIds, onToggle, locked }) => {
  const resolved = useMemo(() => {
    const first = eligible.find((r) => selectedIds.includes(r.id));
    return first ? `${first.buyerName} · ${first.buyerCountry}` : null;
  }, [eligible, selectedIds]);

  const totalQty = useMemo(
    () => eligible.filter((r) => selectedIds.includes(r.id)).reduce((s, r) => s + (r.quantity || 0), 0),
    [eligible, selectedIds],
  );

  const columns = [
    {
      title: '', key: 'pick', width: 44,
      render: (_, r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          disabled={locked || (!r.eligible && !selectedIds.includes(r.id))}
          onChange={() => onToggle(r.id)}
        />
      ),
    },
    { title: 'SR Number', dataIndex: 'srNo', key: 'srNo', width: 150, render: (v, r) => <Text strong type={r.eligible ? undefined : 'secondary'}>{v}</Text> },
    { title: 'Style No', dataIndex: 'styleNo', key: 'styleNo', width: 130 },
    { title: 'Garment', dataIndex: 'garmentName', key: 'garmentName', ellipsis: true },
    {
      title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 170,
      render: (v) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{v}</Tag>,
    },
    { title: 'Round', dataIndex: 'round', key: 'round', width: 70, align: 'center', render: (v) => `R${v}` },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' },
    {
      title: 'Status', key: 'status', width: 235,
      // Ineligibility reasons ("Covered by EXSG0034/26-27") stay on ONE line —
      // the column is wide enough and the table scrolls if space runs out.
      render: (_, r) => (r.eligible
        ? <StatusTag status={r.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
        : <Tag color="red" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{r.reason}</Tag>),
    },
    { title: 'Dispatch Deadline', dataIndex: 'dispatchDeadline', key: 'dispatchDeadline', width: 130, render: (d) => formatDate(d) },
  ];

  return (
    <>
      {locked && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Issued invoice — style selection is locked. Cancel and duplicate to correct." />
      )}
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={eligible}
        pagination={false}
        rowClassName={(r) => (!r.eligible && !selectedIds.includes(r.id) ? 'ant-table-row-disabled' : '')}
        scroll={{ x: 1180 }}
        footer={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>
              <Text strong>{selectedIds.length}</Text> style{selectedIds.length === 1 ? '' : 's'} selected · consignee and destination must match across all lines on one invoice
            </Text>
            <Text strong>{totalQty} pcs{resolved ? ` · ${resolved}` : ''}</Text>
          </div>
        )}
      />
    </>
  );
};

export default InvoiceStepStyles;
