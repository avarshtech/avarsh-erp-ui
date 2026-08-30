import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listMeasurements, getOrders } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';

/** PRD 4.6 — spec vs actual measurement reports at in-line / pre-final / final stages. */
const MeasurementReportList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reports, ords] = await Promise.all([listMeasurements(), getOrders()]);
      setRows(reports); setOrders(ords);
    } catch { message.error('Failed to load measurement reports'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Report #', dataIndex: 'reportNo', width: 170, render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/sewing/measurement/${r.id}`)} /> },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Stage', dataIndex: 'stage', width: 110, render: (v) => <Tag>{v.replace('_', ' ')}</Tag> },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Failed Points', key: 'fails', width: 110, align: 'center',
      render: (_, r) => {
        const fails = r.points.filter((p) => p.actual != null && Math.abs(p.actual - p.spec) > p.tol).length;
        return fails ? <strong style={{ color: 'var(--error-color)' }}>{fails}</strong> : <Tag color="green">All pass</Tag>;
      },
    },
    { title: 'Inspector', dataIndex: 'inspector', width: 140, ellipsis: true },
    { title: 'Result', dataIndex: 'result', width: 130, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/sewing/measurement/${r.id}`)} />,
    },
  ], [orders, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Spec values auto-populate from the Tech Pack; any FAIL flags the report for QA Manager review.</span>
        <ActionButton action="create" text="New Measurement Report" onClick={() => navigate('/production/sewing/measurement/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1050 }} pagination={getTablePagination({ pageSize: 10 }, 'reports')}
        locale={{ emptyText: <EmptyState title="No measurement reports" description="Record in-line or final measurements against spec" /> }} />
    </Card>
  );
};

export default MeasurementReportList;
