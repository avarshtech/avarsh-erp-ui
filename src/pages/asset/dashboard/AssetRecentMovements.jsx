import { memo } from 'react';
import { Card, Table, Tag } from 'antd';
import { DownOutlined } from '@ant-design/icons';
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
      width: 150,
      render: (code, row) => <RecordLink text={code} onClick={() => onOpen(row.assetId)} />,
    },
    { title: 'Name', dataIndex: 'assetName', ellipsis: true },
    {
      title: 'What happened',
      dataIndex: 'eventType',
      width: 130,
      render: (v) => <Tag color={eventMeta(v).color}>{eventMeta(v).label}</Tag>,
    },
    {
      // One column, not two. Two 200px columns of full location paths pushed the
      // table past its card and left it on a horizontal scrollbar on a screen
      // with room to spare - and a move reads as one thing anyway, so the old
      // place sits above the new one rather than an arm's length to its left.
      title: 'Where it moved',
      key: 'move',
      render: (_, row) => (
        <>
          {row.fromLocationText
            // An asset being added has no "from", and a dash reads better than a gap.
            ? <div style={{ opacity: 0.6 }}>{row.fromLocationText}</div>
            : <div style={{ opacity: 0.45 }}>—</div>}
          <div>
            <DownOutlined style={{ fontSize: 9, opacity: 0.4, marginRight: 6 }} />
            {row.toLocationText || '-'}
          </div>
        </>
      ),
    },
    { title: 'When', dataIndex: 'movedAt', width: 140, render: stamp },
  ];

  return (
    <Card title="Recent movements" style={{ height: '100%', width: '100%' }}>
      <Table
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 760 }}
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
