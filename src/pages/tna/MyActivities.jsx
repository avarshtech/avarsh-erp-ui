import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Card, Select, Table, Tag, Tooltip, Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { listMyActivities, getMeta } from '../../services/tna/tnaService';
import { SOURCE_MODULES, fmtDate, signedDays } from '../../utils/tnaConstants';
import TnaStatusTag from './components/TnaStatusTag';
import MockDataNote from './components/MockDataNote';

const { Text } = Typography;
const mono = { fontFamily: 'var(--font-mono, monospace)' };

/**
 * Activities owned through their source module, across every live order, ranked by urgency:
 * overdue first, then due soon, then critical (FR-6.5). Read-only — the work is done in the
 * source screen, and the activity completes when its event arrives.
 */
const MyActivities = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [result, setResult] = useState({ key: null, rows: [] });
  const [meta, setMeta] = useState(null);
  const key = module || 'ALL';

  useEffect(() => { getMeta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => {
    listMyActivities({ module: key === 'ALL' ? null : key })
      .then((rows) => setResult({ key, rows }))
      .catch(() => { message.error('Failed to load activities'); setResult({ key, rows: [] }); });
  }, [key, message]);
  const loading = result.key !== key;
  const rows = result.rows;

  const columns = useMemo(() => [
    { title: 'Order', dataIndex: 'orderNo', width: 132, fixed: 'left', render: (v) => <Text strong style={mono}>{v}</Text> },
    { title: 'Buyer / style', key: 'b', width: 170, render: (_, r) => `${r.buyer} / ${r.styleNo}` },
    { title: 'Code', dataIndex: 'code', width: 66, render: (v) => <Text style={mono}>{v}</Text> },
    {
      title: 'Activity', dataIndex: 'name', width: 250,
      render: (v, r) => <span>{v}{r.isGate && <Tag color="blue" style={{ marginLeft: 4 }}>gate</Tag>}{r.awaitingSource && <Tooltip title={r.missingNote}><Tag color="orange" style={{ marginLeft: 4 }}>awaiting source</Tag></Tooltip>}</span>,
    },
    { title: 'Owner module', dataIndex: 'sourceModule', width: 130 },
    { title: 'Completes on', dataIndex: 'completionEvent', width: 200, render: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: 'Revised target', dataIndex: 'revisedTarget', width: 112, render: fmtDate },
    { title: 'Forecast', dataIndex: 'forecastDate', width: 104, render: fmtDate },
    { title: 'Overdue', dataIndex: 'overdueDays', width: 80, align: 'center', render: (v) => (v > 0 ? <Tag color="red" style={{ marginInlineEnd: 0 }}>{v} WD</Tag> : '—') },
    { title: 'Float', dataIndex: 'floatDays', width: 80, align: 'right', render: (v) => <span style={{ ...mono, color: v <= 0 ? 'var(--error-color)' : undefined }}>{signedDays(v, 'WD')}</span> },
    { title: 'Status', dataIndex: 'status', width: 140, render: (s) => <TnaStatusTag status={s} /> },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="My activities"
        subtitle="Open activities owned by your source module, across every live order — overdue first"
        extra={<MockDataNote asOf={meta?.asOf} />}
      />
      <Card size="small" styles={{ body: { paddingTop: 12 } }}>
        <Select
          allowClear
          name="ownerModule"
          placeholder="Owner module: all"
          style={{ width: 240, marginBottom: 12 }}
          value={module}
          onChange={(v) => setModule(v || null)}
          options={SOURCE_MODULES.map((m) => ({ value: m, label: m }))}
        />
        <Alert type="info" style={{ marginBottom: 12 }} title="Nothing is entered here. Do the work in the owning screen; the activity completes when that screen's completion event arrives." />
        <Table
          rowKey={(r) => `${r.planId}-${r.code}`}
          size="small"
          bordered
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          scroll={{ x: 1650, y: 'calc(100vh - 360px)' }}
          onRow={(r) => ({ onClick: () => navigate(`/tna/plan/${r.planId}?activity=${r.code}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </div>
  );
};

export default MyActivities;
