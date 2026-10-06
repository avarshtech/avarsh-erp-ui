import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import StatusBadge from '../../../components/StatusBadge';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

const { Text } = Typography;
const SHOWN_PROCESSES = 3;

/** Enter or Space opens the vendor, as a click does. */
const onActivate = (open) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    open();
  }
};

/**
 * The Vendor master's table. dataIndex is set on every data column: Laya AI reads the list through it,
 * and none of them is a private field.
 */
export const vendorColumns = ({ nameOf, onView, onEdit, onDeactivate, canView, canUpdate, canDelete, deactivatingId }) => [
  {
    title: 'Vendor',
    dataIndex: 'name',
    key: 'name',
    width: 220,
    ellipsis: true,
    sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    render: (name, record) => (
      <Text strong role="button" tabIndex={0} aria-label={`View ${name}`} style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
        onClick={() => onView(record)} onKeyDown={onActivate(() => onView(record))}>{name}</Text>
    ),
  },
  {
    title: 'GSTIN',
    dataIndex: 'gstin',
    key: 'gstin',
    width: 160,
    render: (gstin) => (gstin
      ? <Text style={{ fontFamily: 'monospace' }}>{gstin}</Text>
      : <Text type="secondary">Unregistered</Text>),
  },
  {
    title: 'City / State',
    dataIndex: 'city',
    key: 'place',
    width: 170,
    ellipsis: true,
    render: (_, record) => <Text type="secondary">{[record.city, record.state].filter(Boolean).join(', ') || '-'}</Text>,
  },
  {
    title: 'Processes',
    dataIndex: 'processIds',
    key: 'processes',
    width: 280,
    render: (ids = []) => {
      if (!ids.length) return <Text type="secondary">None yet</Text>;
      const rest = ids.slice(SHOWN_PROCESSES).map(nameOf);
      return (
        <Space size={4} wrap>
          {ids.slice(0, SHOWN_PROCESSES).map((id) => <Tag key={id}>{nameOf(id)}</Tag>)}
          {rest.length > 0 && <Tooltip title={rest.join(', ')}><Tag>+{rest.length}</Tag></Tooltip>}
        </Space>
      );
    },
  },
  {
    title: 'Job-work Approval',
    dataIndex: 'jobWorkApprovedUntil',
    key: 'approval',
    width: 180,
    render: (until) => {
      const approval = jobWorkApproval(until);
      return <Tag color={approval.color}>{approval.label}</Tag>;
    },
  },
  {
    title: 'Status',
    dataIndex: 'active',
    key: 'active',
    width: 100,
    align: 'center',
    render: (active) => <StatusBadge status={active !== false ? 'active' : 'inactive'} />,
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: (_, record) => (
      <Space size="small">
        {canView && <ActionButton action="view" onClick={() => onView(record)} />}
        {canUpdate && <ActionButton action="edit" onClick={() => onEdit(record)} />}
        {canDelete && record.active !== false && (
          <DeleteConfirm
            title="Deactivate"
            description={`Deactivate "${record.name}"? It leaves every vendor picker; documents that name it keep it.`}
            okText="Deactivate"
            onConfirm={() => onDeactivate(record)}
            loading={deactivatingId === record.id}
          >
            <ActionButton action="delete" tooltip="Deactivate" />
          </DeleteConfirm>
        )}
      </Space>
    ),
  },
];
