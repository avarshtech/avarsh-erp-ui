import { useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Table, Space, Tag } from 'antd';
import EmptyState from '../../../components/EmptyState';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { getOperators, getSamValues, getIncentives } from '../../../services/production/sewingService';
import SkillMatrixHeatmap from './SkillMatrixHeatmap';
import SewingStatusTag from './SewingStatusTag';

/** PRD 5.1 / 5.2 / 5.3 — operator skills, SAM masters and incentive computation. */
const OperatorSamTab = () => {
  const { message } = App.useApp();
  const [view, setView] = useState('Skill Matrix');
  const [operators, setOperators] = useState([]);
  const [samValues, setSamValues] = useState([]);
  const [incentives, setIncentives] = useState([]);
  const [loading, setLoading] = useState(true);
  const { incentiveSlabs, threshold, labelOf } = useSewingMasters();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ops, sam, inc] = await Promise.all([getOperators(), getSamValues(), getIncentives()]);
        setOperators(ops); setSamValues(sam); setIncentives(inc);
      } catch { message.error('Failed to load operator data'); } finally { setLoading(false); }
    })();
  }, [message]);

  const samRows = useMemo(() => samValues.flatMap((s) => s.operations.map((o, i) => ({
    key: `${s.styleNo}-${i}`, styleNo: s.styleNo, source: s.source, approvedBy: s.approvedBy, ...o,
    totalSam: s.totalSam, isFirst: i === 0, span: s.operations.length,
  }))), [samValues]);

  const samColumns = useMemo(() => [
    { title: 'Style', dataIndex: 'styleNo', width: 130, onCell: (r) => ({ rowSpan: r.isFirst ? r.span : 0 }), render: (v) => <strong>{v}</strong> },
    { title: 'Operation', dataIndex: 'operation', width: 170 },
    { title: 'Machine', dataIndex: 'machine', width: 100, align: 'center', render: (v) => <Tag>{v}</Tag> },
    { title: 'SAM (min)', dataIndex: 'sam', width: 90, align: 'right' },
    { title: 'Garment SAM', dataIndex: 'totalSam', width: 110, align: 'right', onCell: (r) => ({ rowSpan: r.isFirst ? r.span : 0 }), render: (v) => <strong>{v}</strong> },
    { title: 'Source', dataIndex: 'source', width: 140, onCell: (r) => ({ rowSpan: r.isFirst ? r.span : 0 }), render: (v) => (v ? <Tag color="blue">{labelOf('SAM_SOURCE', v)}</Tag> : '—') },
    { title: 'Approved By', dataIndex: 'approvedBy', width: 150, onCell: (r) => ({ rowSpan: r.isFirst ? r.span : 0 }) },
  ], [labelOf]);

  const incentiveColumns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 110 },
    { title: 'Line', dataIndex: 'line', width: 90, align: 'center' },
    { title: 'Operator', dataIndex: 'operator', width: 150 },
    { title: 'Output (pcs)', dataIndex: 'output', width: 100, align: 'right' },
    { title: 'Efficiency', dataIndex: 'effPct', width: 100, align: 'center', render: (v) => `${v}%` },
    { title: 'Slab', dataIndex: 'slab', width: 110, align: 'center' },
    { title: 'Gross ₹', dataIndex: 'gross', width: 90, align: 'right' },
    {
      title: 'DHU Deduction ₹', dataIndex: 'dhuDeduction', width: 130, align: 'right',
      render: (v) => (v ? <span style={{ color: 'var(--error-color)' }}>−{v}</span> : 0),
    },
    { title: 'Net ₹ / day', dataIndex: 'net', width: 100, align: 'right', render: (v) => <strong>{v}</strong> },
  ], []);

  return (
    <Card loading={loading}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <Segmented options={['Skill Matrix', 'SAM Values', 'Incentives']} value={view} onChange={setView} />
        {view === 'Incentives' && (
          <span style={{ color: 'var(--text-secondary)' }}>
            Slabs: {incentiveSlabs.map((s) => `${s.name} → ₹${s.amount}`).join('  ·  ')}
            &nbsp;| DHU &gt; {threshold('DHU_THRESHOLD_PCT', 5)}% deducts {threshold('INCENTIVE_DHU_DEDUCT_PCT', 20)}%
          </span>
        )}
      </Space>
      {view === 'Skill Matrix' && <SkillMatrixHeatmap operators={operators} />}
      {view === 'SAM Values' && (
        <Table rowKey="key" size="small" columns={samColumns} dataSource={samRows} pagination={false} scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState title="No SAM values" description="Maintain SAM per style and operation" /> }} />
      )}
      {view === 'Incentives' && (
        <Table rowKey={(r) => `${r.date}-${r.operatorId}`} size="small" columns={incentiveColumns} dataSource={incentives}
          pagination={false} scroll={{ x: 950 }}
          locale={{ emptyText: <EmptyState title="No incentive data" description="Incentives compute from hourly production" /> }} />
      )}
      {view === 'Skill Matrix' && (
        <Space style={{ marginTop: 12 }} wrap>
          <span style={{ color: 'var(--text-secondary)' }}>Operator status:</span>
          {operators.map((o) => (
            <Space key={o.id} size={4}>
              <span>{o.code}</span>
              <SewingStatusTag status={o.status} />
            </Space>
          ))}
        </Space>
      )}
    </Card>
  );
};

export default OperatorSamTab;
