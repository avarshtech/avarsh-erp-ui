import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { DHU_ALERT_PCT, CHECK_STAGES } from '../../../utils/finishingConstants';
import { listCheckings, getOrders, dhuPct } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';

/** PRD Module 5 — pre-final (100%) and final (AQL 2.5) checking sheets. */
const CheckingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [checks, ords] = await Promise.all([listCheckings(), getOrders()]);
      setRows(checks); setOrders(ords);
    } catch { message.error('Failed to load checking sheets'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Check #', dataIndex: 'checkNo', width: 170,
      render: (v, r) => <a onClick={() => navigate(`/production/finishing/checking/${r.id}`)}><code>{v}</code></a>,
    },
    {
      title: 'Stage', dataIndex: 'stage', width: 150,
      render: (v) => <Tag color={v === 'FINAL' ? 'purple' : 'blue'}>{CHECK_STAGES.find((s) => s.key === v)?.label || v}</Tag>,
    },
    { title: 'Order', dataIndex: 'orderId', width: 140, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Checked', key: 'checked', width: 90, align: 'right', render: (_, r) => r.passQty + r.alterQty + r.rejectQty },
    { title: 'Pass', dataIndex: 'passQty', width: 80, align: 'right', render: (v) => <span style={{ color: 'var(--success-color)' }}>{v}</span> },
    { title: 'Alter', dataIndex: 'alterQty', width: 80, align: 'right', render: (v) => (v ? <span style={{ color: 'var(--warning-color)' }}>{v}</span> : 0) },
    { title: 'Reject', dataIndex: 'rejectQty', width: 80, align: 'right', render: (v) => (v ? <span style={{ color: 'var(--error-color)' }}>{v}</span> : 0) },
    {
      title: 'DHU %', key: 'dhu', width: 90, align: 'center',
      render: (_, r) => {
        const dhu = dhuPct((r.defects || []).reduce((s, d) => s + d.count, 0), r.passQty + r.alterQty + r.rejectQty);
        return <strong style={{ color: dhu > DHU_ALERT_PCT ? 'var(--error-color)' : 'var(--success-color)' }}>{dhu}%</strong>;
      },
    },
    {
      title: 'AQL Verdict', key: 'verdict', width: 120,
      render: (_, r) => (r.stage === 'FINAL' ? <FinishingStatusTag status={r.verdict} /> : '—'),
    },
  ], [orders, navigate]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <span style={{ color: 'var(--text-secondary)' }}>
          Pre-final inspects 100% of pieces; final checking samples the lot per AQL 2.5. Pass + Alter + Reject must equal total checked.
        </span>
        <ActionButton action="create" text="New Checking Sheet" onClick={() => navigate('/production/finishing/checking/new')} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 10 }, 'sheets')}
        locale={{ emptyText: <EmptyState title="No checking sheets" description="Start a pre-final or final AQL inspection" /> }} />
    </Card>
  );
};

export default CheckingList;
