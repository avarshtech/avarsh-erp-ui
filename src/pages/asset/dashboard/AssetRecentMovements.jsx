import { memo } from 'react';
import { Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { eventMeta } from '../../../utils/assetConstants';

const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '-');

/**
 * The last movements across the whole register (PRD section L).
 *
 * Deliberately not filtered to transfers: an asset being added and an asset
 * being disposed are movements too, and the question this panel answers is
 * "what has changed lately", not "what has been transferred lately".
 */
const AssetRecentMovements = memo(function AssetRecentMovements({ rows = [], loading = false, onOpen }) {
  const columns = [
    {
      title: 'Asset',
      dataIndex: 'assetCode',
      width: 170,
      render: (code, row) => <RecordLink text={code} onClick={() => onOpen(row.assetId)} />,
    },
    { title: 'Name', dataIndex: 'assetName', ellipsis: true },
    {
      title: 'What happened',
      dataIndex: 'eventType',
      width: 150,
      render: (v) => <Tag color={eventMeta(v).color}>{eventMeta(v).label}</Tag>,
    },
    {
      title: 'From',
      dataIndex: 'fromLocationText',
      width: 200,
      // An asset being added has no "from", and a dash reads better than a gap.
      render: (v) => v || <span style={{ opacity: 0.45 }}>—</span>,
    },
    { title: 'To', dataIndex: 'toLocationText', width: 200, render: (v) => v || '-' },
    { title: 'When', dataIndex: 'movedAt', width: 150, render: stamp },
  ];

  return (
    <Card title="Recent movements">
      <Table
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <EmptyState
              title="Nothing has moved yet"
              description="Every addition, transfer and disposal shows here as it happens."
            />
          ),
        }}
      />
    </Card>
  );
});

export default AssetRecentMovements;
