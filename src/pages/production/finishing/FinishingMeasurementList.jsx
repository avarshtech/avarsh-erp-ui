import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listFinishingMeasurements, getOrders, getEmployees } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';

/** PRD Module 7 — post-iron measurement audits with lot HOLD on failure. */
const FinishingMeasurementList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reports, ords, emps] = await Promise.all([listFinishingMeasurements(), getOrders(), getEmployees()]);
      setRows(reports); setOrders(ords); setEmployees(emps);
    } catch { message.error('Failed to load measurement reports'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Report #', dataIndex: 'reportNo', width: 170,
      render: (v, r) => <a onClick={() => navigate(`/production/finishing/measurement/${r.id}`)}><code>{v}</code></a>,
    },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Sample', dataIndex: 'sampleSize', width: 80, align: 'center' },
    { title: 'Iron Operator', dataIndex: 'ironOperatorId', width: 160, render: (v) => employees.find((e) => e.id === v)?.name || '—' },
    { title: 'Result', dataIndex: 'overallResult', width: 100, render: (v) => <FinishingStatusTag status={v} /> },
    { title: 'Lot', dataIndex: 'lotStatus', width: 110, render: (v) => <FinishingStatusTag status={v === 'RELEASED' ? 'PASS' : v} /> },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true },
  ], [orders, employees, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          Random 5–10 pc audit after ironing catches heat shrinkage. Any failed point holds the whole lot for re-measure or re-iron.
        </span>
        <ActionButton action="create" text="New Measurement Audit" onClick={() => navigate('/production/finishing/measurement/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        rowClassName={(r) => (r.lotStatus === 'HOLD' ? 'row-shortage' : '')}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 10 }, 'reports')}
        locale={{ emptyText: <EmptyState title="No measurement audits" description="Audit dimensions after pressing to catch shrinkage" /> }} />
    </Card>
  );
};

export default FinishingMeasurementList;
