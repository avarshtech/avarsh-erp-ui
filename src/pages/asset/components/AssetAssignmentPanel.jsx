import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import { getAssignments } from '../../../services/asset/assignmentService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { conditionMeta } from '../../../utils/assetConstants';
import AssetAssignmentDialog from './AssetAssignmentDialog';

const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');

/**
 * Who has had this asset, and who has it now.
 *
 * Only shown for a category marked issuable - a compressor bolted to the floor
 * has no business carrying an issue history, and showing an empty panel on
 * every machine would train people to ignore it.
 */
const AssetAssignmentPanel = ({ asset, assignable, canEdit, onAssetChanged }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getAssignments(asset.id));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the issue history');
    } finally {
      setLoading(false);
    }
  }, [asset.id, message]);

  useEffect(() => { load(); }, [load]);

  if (!assignable) return null;

  const open = rows.find((r) => r.status === 'OPEN');

  const columns = [
    {
      title: 'Held by',
      key: 'who',
      width: 230,
      render: (_, r) => (
        <>
          <div>{r.employeeName}</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            {[r.employeeNo, r.designationText].filter(Boolean).join(' · ')}
          </div>
        </>
      ),
    },
    { title: 'Issued', dataIndex: 'assignedOn', width: 120, render: date },
    {
      title: 'Due back',
      dataIndex: 'expectedReturn',
      width: 140,
      render: (v, r) => (r.overdue
        ? <Tag color="red">Overdue — {date(v)}</Tag>
        : date(v)),
    },
    { title: 'Returned', dataIndex: 'returnedOn', width: 120, render: date },
    {
      title: 'Condition out / back',
      key: 'condition',
      width: 190,
      render: (_, r) => (
        <>
          <Tag color={conditionMeta(r.conditionIssue).color}>{conditionMeta(r.conditionIssue).label}</Tag>
          {r.conditionReturn && (
            <>
              <span style={{ opacity: 0.45 }}>→</span>
              <Tag color={conditionMeta(r.conditionReturn).color}>{conditionMeta(r.conditionReturn).label}</Tag>
            </>
          )}
        </>
      ),
    },
    { title: 'Accessories', dataIndex: 'accessories', render: (v) => v || '-' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v, r) => (v === 'OPEN'
        ? (
          <PermissionGuard module="asset-assignments" operation="update">
            <ActionButton action="undo" size="small" text="Return" onClick={() => setDialog({ mode: 'return', row: r })} />
          </PermissionGuard>
        )
        : <Tag>Returned</Tag>),
    },
  ];

  return (
    <Card
      title="Issued to"
      style={{ marginTop: 16 }}
      extra={canEdit && asset.status !== 'DISPOSED' && !open && (
        <PermissionGuard module="asset-assignments" operation="add">
          <ActionButton action="custom" text="Issue to someone" onClick={() => setDialog({ mode: 'issue' })} />
        </PermissionGuard>
      )}
    >
      {open && (
        <Alert
          type={open.overdue ? 'warning' : 'info'}
          showIcon
          title={`Out with ${open.employeeName} since ${date(open.assignedOn)}`}
          description={open.overdue
            ? `It was due back on ${date(open.expectedReturn)}.`
            : 'The asset is still recorded here — an issue is not a move.'}
          style={{ marginBottom: 16 }}
        />
      )}
      <Table
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState title="Never issued" description="This asset has not been handed to anybody yet." /> }}
      />

      <AssetAssignmentDialog
        dialog={dialog}
        asset={asset}
        onClose={() => setDialog(null)}
        onSaved={() => { setDialog(null); load(); onAssetChanged?.(); }}
      />
    </Card>
  );
};

export default AssetAssignmentPanel;
