import { useCallback, useEffect, useState } from 'react';
import { App, Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import { getAssetStatusHistory } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { statusMeta, conditionMeta } from '../../../utils/assetConstants';

/**
 * Everywhere this asset's state has been, newest first.
 *
 * Append-only on the server, so this is the audit trail for "how long has this
 * machine been standing, and why" - the question the status alone cannot
 * answer because it only ever shows the latest value.
 */
const COLUMNS = [
  {
    title: 'When',
    dataIndex: 'changedAt',
    width: 150,
    render: (value) => (value ? dayjs(value).format('DD-MM-YYYY HH:mm') : '-'),
  },
  {
    title: 'Status',
    key: 'status',
    width: 220,
    render: (_, row) => (
      <>
        {row.fromStatus && (
          <>
            <Tag color={statusMeta(row.fromStatus).color}>{statusMeta(row.fromStatus).label}</Tag>
            <span style={{ opacity: 0.45, marginInlineEnd: 6 }}>&rarr;</span>
          </>
        )}
        <Tag color={statusMeta(row.toStatus).color}>{statusMeta(row.toStatus).label}</Tag>
      </>
    ),
  },
  {
    title: 'Condition',
    key: 'condition',
    width: 130,
    // Only when it actually moved: a condition column repeating "Good" on every
    // row is noise on a panel whose job is to show what changed.
    render: (_, row) => (row.toCondition && row.toCondition !== row.fromCondition
      ? <Tag color={conditionMeta(row.toCondition).color}>{conditionMeta(row.toCondition).label}</Tag>
      : '-'),
  },
  { title: 'Reason', dataIndex: 'reasonLabel', render: (value) => value || '-' },
  { title: 'Notes', dataIndex: 'reasonText', render: (value) => value || '-' },
];

const AssetStatusHistory = ({ assetId, refreshKey }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getAssetStatusHistory(assetId));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the status history');
    } finally {
      setLoading(false);
    }
  }, [assetId, message]);

  // refreshKey changes when the Change Status dialog saves, so the panel below
  // it does not sit showing the state before the change.
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <Card title="Status history" style={{ marginTop: 16 }}>
      <Table
        columns={COLUMNS}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <EmptyState title="No status changes" description="Every asset gets a row when it is added, so this should not be empty." />,
        }}
      />
    </Card>
  );
};

export default AssetStatusHistory;
