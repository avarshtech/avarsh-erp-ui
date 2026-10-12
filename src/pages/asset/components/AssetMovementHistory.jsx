import { Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import { eventMeta } from '../../../utils/assetConstants';

/**
 * Where the asset has been, newest first.
 *
 * Append-only on the server: a row is written when the asset is created, when a
 * transfer completes and when it is disposed. Nothing edits or deletes one, so
 * this table is the audit trail.
 */
const COLUMNS = [
  {
    title: 'When',
    dataIndex: 'movedAt',
    width: 170,
    render: (value) => (value ? dayjs(value).format('DD-MM-YYYY HH:mm') : '-'),
  },
  {
    title: 'Event',
    dataIndex: 'eventType',
    width: 160,
    render: (value) => <Tag color={eventMeta(value).color}>{eventMeta(value).label}</Tag>,
  },
  { title: 'From', dataIndex: 'fromLocationText', render: (value) => value || '-' },
  { title: 'To', dataIndex: 'toLocationText', render: (value) => value || '-' },
  { title: 'Reason', dataIndex: 'reason', render: (value) => value || '-' },
];

const AssetMovementHistory = ({ movements }) => (
  <Card title="Movement history" style={{ marginTop: 16 }}>
    <Table
      columns={COLUMNS}
      dataSource={movements ?? []}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{
        emptyText: <EmptyState title="No movements" description="Every asset gets a row when it is added, so this should not be empty." />,
      }}
    />
  </Card>
);

export default AssetMovementHistory;
