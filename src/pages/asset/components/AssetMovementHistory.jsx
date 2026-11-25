import { useMemo, useState } from 'react';
import { Card, Switch, Table, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import { eventMeta, isRealMove } from '../../../utils/assetConstants';

/**
 * Where the asset has been, newest first.
 *
 * Append-only on the server: a row is written when the asset is created, when a
 * transfer completes, when its line changes and when it is disposed. Nothing edits
 * or deletes one, so this table is the audit trail.
 *
 * Line changes are hidden by default. They are real history and worth keeping - a
 * busy floor moves a machine between lines several times a week - but they are not
 * moves, and left in they outnumber the transfers ten to one and bury them. The
 * toggle says how many are being held back rather than hiding that they exist.
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

const AssetMovementHistory = ({ movements }) => {
  const [showLineChanges, setShowLineChanges] = useState(false);

  const all = useMemo(() => movements ?? [], [movements]);
  const lineChanges = useMemo(() => all.filter((m) => !isRealMove(m.eventType)).length, [all]);
  const shown = useMemo(
    () => (showLineChanges ? all : all.filter((m) => isRealMove(m.eventType))),
    [all, showLineChanges],
  );

  return (
    <Card
      title="Movement history"
      style={{ marginTop: 16 }}
      extra={lineChanges > 0 && (
        <Tooltip title="A line change keeps the asset on its floor, so it is not a move. It is recorded all the same.">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <Switch
              size="small"
              checked={showLineChanges}
              onChange={setShowLineChanges}
              aria-label="Show line changes in the movement history"
            />
            {`Show ${lineChanges} line change${lineChanges === 1 ? '' : 's'}`}
          </span>
        </Tooltip>
      )}
    >
      <Table
        columns={COLUMNS}
        dataSource={shown}
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
};

export default AssetMovementHistory;
