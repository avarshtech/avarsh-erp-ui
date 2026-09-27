import { memo } from 'react';
import { Table, Tooltip } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', width: 96, render: n });

const COLUMNS = [
  { title: 'CPR No.', dataIndex: 'cprNo', width: 150 },
  { title: 'Order', dataIndex: 'orderNo', width: 140 },
  { title: 'Buyer', dataIndex: 'buyer', ellipsis: true },
  { title: 'Style', dataIndex: 'styleNo', width: 100 },
  {
    title: 'Status', dataIndex: 'status', width: 140,
    render: (s) => <StatusTag status={s} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} size="small" />,
  },
  num('Required', 'required'),
  num("PO'd", 'allocated'),
  { ...num('In draft PO', 'inDraft'), render: (v) => (v ? n(v) : '—') },
  { ...num('Balance', 'balance'), render: (v) => <strong>{n(v)}</strong> },
];

/**
 * Requirement lookup for the chosen process (PRD FR-08/09/10): requirements with balance
 * are selectable; fully allocated ones stay listed, greyed and not selectable, so the user
 * sees they were covered rather than missing. Several may be picked (BR-04).
 */
const CppRequirementLookup = memo(function CppRequirementLookup({ rows, loading, selectedIds, onSelect }) {
  return (
    <Table
      size="small" rowKey="id" pagination={false} loading={loading} dataSource={rows} columns={COLUMNS} scroll={{ x: 1000 }}
      locale={{ emptyText: 'No submitted cut panel requirement carries this process.' }}
      rowSelection={{
        selectedRowKeys: selectedIds,
        onChange: (keys) => onSelect(keys),
        getCheckboxProps: (r) => ({ disabled: !r.selectable, name: `cpr-${r.cprNo}`, 'aria-label': `Select ${r.cprNo}` }),
        renderCell: (checked, r, i, node) => (r.selectable ? node : <Tooltip title="Fully allocated for this process">{node}</Tooltip>),
      }}
      onRow={(r) => ({ style: r.selectable ? undefined : { opacity: 0.55 } })}
    />
  );
});

export default CppRequirementLookup;
