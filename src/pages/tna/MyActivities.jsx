import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Table, Tooltip } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import TnaStatusTag from './components/TnaStatusTag';
import FloatBar from './components/FloatBar';
import ActualDrawer from './plan/ActualDrawer';
import { listMyActivities } from '../../services/tna/tnaService';
import { DATE_FORMAT } from '../../utils/uiConstants';
import { getTablePagination } from '../../utils/paginationConfig';

/** §15 "My activities" — everything assigned to me, urgency first, three taps to complete. */
const MyActivities = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // {planId, line}

  const load = useCallback(() => {
    listMyActivities()
      .then(setRows)
      .catch(() => message.error('Failed to load your activities'))
      .finally(() => setLoading(false));
  }, [message]);
  useEffect(load, [load]);

  const columns = useMemo(() => [
    { title: 'Status', dataIndex: 'status', width: 150, render: (v) => <TnaStatusTag status={v} size="small" /> },
    {
      title: 'Activity',
      dataIndex: 'name',
      render: (v, r) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{r.code}</span>
          <span style={{ fontWeight: 600 }}>{v}</span>
        </div>
      ),
    },
    {
      title: 'Order',
      dataIndex: 'orderNo',
      width: 200,
      render: (v, r) => (
        <div>
          <Link to={`/tna/plan/${r.planId}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</Link>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{r.buyer} · {r.styleNo}</div>
        </div>
      ),
    },
    {
      title: 'Planned',
      dataIndex: 'plannedDate',
      width: 150,
      render: (v) => {
        const diff = dayjs(v).diff(dayjs().startOf('day'), 'day');
        return (
          <div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{dayjs(v).format(DATE_FORMAT)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: diff < 0 ? 'var(--error-color)' : diff <= 2 ? 'var(--warning-color)' : 'var(--text-muted)' }}>
              {diff < 0 ? `${-diff}d overdue` : diff === 0 ? 'Due today' : `in ${diff}d`}
            </div>
          </div>
        );
      },
    },
    { title: 'Float', dataIndex: 'floatDays', width: 140, render: (v) => <FloatBar floatDays={v} /> },
    {
      title: '',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, r) => r.allowManualActual && (
        <Button size="small" type="primary" ghost icon={<CalendarOutlined />} onClick={() => setDrawer({ planId: r.planId, line: r })}>
          Mark done
        </Button>
      ),
    },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="My Activities" subtitle="Every TNA activity assigned to you across live orders, most urgent first" />
      <Card size="small" styles={{ body: { paddingTop: 12 } }}>
        <Table
          rowKey={(r) => `${r.planId}-${r.code}`}
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={getTablePagination({ pageSize: 25 }, 'activities')}
          scroll={{ x: 860 }}
          onRow={(r) => (r.status === 'OVERDUE_CRITICAL' ? { style: { background: 'color-mix(in srgb, var(--error-color) 4%, transparent)' } } : {})}
        />
      </Card>
      <ActualDrawer
        open={!!drawer}
        planId={drawer?.planId}
        line={drawer?.line}
        onClose={() => setDrawer(null)}
        onSaved={() => { setDrawer(null); load(); }}
      />
    </div>
  );
};

export default MyActivities;
