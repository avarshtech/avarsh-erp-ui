import { memo, useMemo } from 'react';
import { Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
const SEVERITY_COLORS = { error: 'red', warning: 'orange', info: 'blue' };
const SEVERITY_LABELS = { error: 'Critical', warning: 'Warning', info: 'Info' };

const columns = [
  {
    title: 'Severity', dataIndex: 'severity', key: 'severity', width: 100,
    render: (s) => <Tag color={SEVERITY_COLORS[s] || 'default'}>{SEVERITY_LABELS[s] || s}</Tag>,
  },
  { title: 'Alert Message', dataIndex: 'message', key: 'message', ellipsis: true },
  {
    title: 'Module', dataIndex: 'module', key: 'module', width: 140,
    render: (m) => <Tag>{(m || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Tag>,
  },
  {
    title: 'Date', dataIndex: 'date', key: 'date', width: 120,
    render: (d) => dayjs(d).format('DD-MMM-YYYY'),
  },
];

const DashboardAlerts = memo(function DashboardAlerts({ alerts = [], loading = false }) {
  const sorted = useMemo(
    () => [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)),
    [alerts],
  );

  return (
    <Card title="Active Alerts" style={{ height: '100%' }}>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={sorted}
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ y: 360 }}
        locale={{ emptyText: <EmptyState title="No active alerts" description="All clear — no alerts at this time" /> }}
      />
    </Card>
  );
});

export default DashboardAlerts;
