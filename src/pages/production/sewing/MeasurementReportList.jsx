import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { listMeasurements } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';

/** PRD 4.6 — spec vs actual measurement reports at in-line / pre-final / final stages. */
const MeasurementReportList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { labelOf } = useSewingMasters();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMeasurements());
    } catch { message.error('Failed to load measurement reports'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Report #', dataIndex: 'reportNo', width: 170,
      render: (v, r) => <RecordLink text={v} onClick={() => navigate(`/production/sewing/measurement/${r.id}`)} />,
    },
    { title: 'Order', dataIndex: 'orderNo', width: 140, render: (v) => v || '—' },
    { title: 'Style', dataIndex: 'styleNo', width: 130, ellipsis: true, render: (v) => v || '—' },
    { title: 'Stage', dataIndex: 'stage', width: 130, render: (v) => <Tag>{labelOf('MEASUREMENT_STAGE', v)}</Tag> },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Date', dataIndex: 'reportDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Points Measured', key: 'measured', width: 130, align: 'center',
      render: (_, r) => <span>{r.measuredPoints} / {r.totalPoints}</span>,
    },
    {
      title: 'Failed Points', dataIndex: 'failCount', width: 110, align: 'center',
      render: (v, r) => (v ? <strong style={{ color: 'var(--error-color)' }}>{v}</strong>
        : r.measuredPoints ? <Tag color="green">All pass</Tag> : '—'),
    },
    { title: 'Inspector', dataIndex: 'inspector', width: 160, ellipsis: true, render: (v) => v || '—' },
    { title: 'Result', dataIndex: 'result', width: 140, render: (v) => <SewingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/sewing/measurement/${r.id}`)} />,
    },
  ], [navigate, labelOf]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Spec and tolerance come from the style&apos;s uploaded measurement chart; any FAIL flags the report for QA Manager review.</span>
        <ActionButton action="create" text="New Measurement Report" onClick={() => navigate('/production/sewing/measurement/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1350 }} pagination={getTablePagination({ pageSize: 10 }, 'reports')}
        locale={{ emptyText: <EmptyState title="No measurement reports" description="Record in-line or final measurements against the buyer chart" /> }} />
    </Card>
  );
};

export default MeasurementReportList;
