import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Space, Statistic, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import { getMaintenance } from '../../../services/asset/maintenanceService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { MAINTENANCE_TYPE, maintenanceDue } from '../../../utils/assetConstants';
import AssetMaintenanceDialog from './AssetMaintenanceDialog';

/**
 * Everything that has ever been done to this machine, and when it is next due.
 *
 * <p>The three numbers across the top are what somebody standing in front of a
 * machine actually asks: when was it last touched, when is it due again, and
 * how often has it broken down lately. A machine with four breakdowns in a year
 * is a replacement decision, and that only shows up as a count.</p>
 */
const money = (v) => (v === null || v === undefined ? '-' : `₹${Number(v).toLocaleString('en-IN')}`);
const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');

const AssetMaintenancePanel = ({ asset, canEdit, onAssetChanged }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getMaintenance(asset.id));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the maintenance log');
    } finally {
      setLoading(false);
    }
  }, [asset.id, message]);

  useEffect(() => { load(); }, [load]);

  const open = rows.find((r) => r.status === 'OPEN');
  const due = maintenanceDue(asset.nextMaintDate);
  const breakdownsThisYear = rows.filter(
    (r) => r.maintType === 'BREAKDOWN_REPAIR' && dayjs(r.maintDate).isAfter(dayjs().subtract(1, 'year')),
  ).length;

  const columns = [
    { title: 'Date', dataIndex: 'maintDate', width: 120, render: date },
    {
      title: 'Type',
      dataIndex: 'maintTypeLabel',
      width: 160,
      render: (v, r) => <Tag color={r.maintType === 'BREAKDOWN_REPAIR' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'Done by',
      key: 'by',
      width: 180,
      render: (_, r) => r.doneByName || r.vendorName || r.vendorText || '-',
    },
    { title: 'Description', dataIndex: 'description', render: (v) => v || '-' },
    { title: 'Cost', dataIndex: 'cost', width: 110, align: 'right', render: money },
    { title: 'Next due', dataIndex: 'nextDueDate', width: 120, render: date },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (v, r) => (v === 'OPEN'
        ? (
          <Space>
            <Tag color="orange">Open</Tag>
            {canEdit && (
              <Button size="small" onClick={() => setDialog({ mode: 'close', entry: r })}>Close</Button>
            )}
          </Space>
        )
        : <Tag>Closed</Tag>),
    },
  ];

  return (
    <Card
      title="Maintenance"
      style={{ marginTop: 16 }}
      extra={canEdit && asset.status !== 'DISPOSED' && (
        <PermissionGuard module="assets" operation="update">
          <ActionButton
            action="create"
            text="Log maintenance"
            disabled={!!open}
            tooltip={open ? 'Close the open job first' : undefined}
            onClick={() => setDialog({ mode: 'log' })}
          />
        </PermissionGuard>
      )}
    >
      <Space size="large" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Statistic title="Last serviced" value={date(asset.lastMaintenanceDate)} />
        <Statistic
          title="Next due"
          value={asset.nextMaintDate ? date(asset.nextMaintDate) : 'Not scheduled'}
          styles={{ content: { color: due?.color === 'red' ? '#cf1322' : undefined } }}
        />
        <Statistic
          title="Breakdowns (12 months)"
          value={breakdownsThisYear}
          styles={{ content: { color: breakdownsThisYear >= 3 ? '#cf1322' : undefined } }}
        />
        {due && <Tag color={due.color} style={{ alignSelf: 'center' }}>{due.label}</Tag>}
      </Space>

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
              title="Nothing logged yet"
              description={`Log a service or a repair and the next due date is worked out from the ${MAINTENANCE_TYPE.PREVENTIVE.toLowerCase()} interval on its category.`}
            />
          ),
        }}
      />

      <AssetMaintenanceDialog
        dialog={dialog}
        asset={asset}
        onClose={() => setDialog(null)}
        onSaved={() => { setDialog(null); load(); onAssetChanged?.(); }}
      />
    </Card>
  );
};

export default AssetMaintenancePanel;
