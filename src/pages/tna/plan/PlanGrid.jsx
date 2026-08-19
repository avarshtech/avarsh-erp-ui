import { memo, useMemo, useState } from 'react';
import { Table, Tag, Tooltip, Space, Switch, Segmented, Button } from 'antd';
import { StarFilled, PaperClipOutlined, EditOutlined, CalendarOutlined, ThunderboltFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import TnaStatusTag from '../components/TnaStatusTag';
import FloatBar from '../components/FloatBar';
import DeviationCell from '../components/DeviationCell';
import { GROUP_COLORS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const fmt = (d) => (d ? dayjs(d).format(DATE_FORMAT) : '—');

/** §10.2 activity grid. Planned dates are never editable here — re-plan is a workflow. */
const PlanGrid = memo(function PlanGrid({ plan, onRecordActual, onProposeReplan }) {
  const [showBaseline, setShowBaseline] = useState(false);
  const [devVs, setDevVs] = useState('baseline');
  const [criticalOnly, setCriticalOnly] = useState(false);

  const maxFloat = useMemo(() => Math.max(10, ...plan.lines.map((l) => l.floatDays)), [plan.lines]);
  const dataSource = useMemo(() => (criticalOnly ? plan.lines.filter((l) => l.isCritical) : plan.lines), [plan.lines, criticalOnly]);
  const canAct = ['ACTIVE', 'DRAFT'].includes(plan.planStatus);

  const columns = useMemo(() => [
    { title: '#', dataIndex: 'sequence', width: 42, align: 'center', render: (v) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v}</span> },
    {
      title: 'Activity',
      dataIndex: 'name',
      width: 250,
      render: (v, l) => (
        <Tooltip title={l.predecessors.length ? `After: ${l.predecessors.join(', ')} · Responsible: ${l.responsible}` : `Start activity · Responsible: ${l.responsible}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: `3px solid ${GROUP_COLORS[l.group]}`, paddingLeft: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{l.code}</span>
            <span style={{ fontWeight: l.isCritical ? 600 : 400 }}>{v}</span>
            {l.milestone && <StarFilled style={{ color: 'var(--accent-color)', fontSize: 11 }} />}
            {l.attachmentName && <PaperClipOutlined style={{ color: 'var(--text-muted)', fontSize: 11 }} />}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Days',
      dataIndex: 'effectiveDays',
      width: 62,
      align: 'right',
      render: (v, l) => (
        <Tooltip title={`Raw scaled: ${l.rawDays}d${l.compressedBy ? ` · compressed −${l.compressedBy}d to fit the leadtime` : ''}${l.fixed ? ' · fixed duration (does not scale)' : ` · floor ${l.minDays}d / ceiling ${l.maxDays}d`}`}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}{l.compressedBy ? <ThunderboltFilled style={{ color: 'var(--warning-color)', fontSize: 10, marginLeft: 3 }} /> : null}</span>
        </Tooltip>
      ),
    },
    { title: 'Planned', dataIndex: 'plannedDate', width: 112, render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span> },
    ...(showBaseline ? [{ title: 'Baseline', dataIndex: 'baselineDate', width: 112, render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fmt(v)}</span> }] : []),
    { title: 'Latest Allowable', dataIndex: 'latestAllowableDate', width: 118, render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fmt(v)}</span> },
    { title: 'Float', dataIndex: 'floatDays', width: 140, render: (v) => <FloatBar floatDays={v} max={maxFloat} /> },
    {
      title: 'Actual',
      dataIndex: 'actualDate',
      width: 130,
      render: (v, l) => (v ? (
        <Tooltip title={`Source: ${l.actualSource}${l.actualSourceRef ? ` · ${l.actualSourceRef}` : ''}`}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span>
        </Tooltip>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>),
    },
    { title: 'Deviation', width: 90, align: 'right', render: (_, l) => <DeviationCell deviationDays={devVs === 'baseline' ? l.deviationDays : l.deviationVsPlan} vsLabel={devVs} /> },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <TnaStatusTag status={v} size="small" /> },
    {
      title: '',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, l) => canAct && (
        <Space size={2}>
          {!l.actualDate && l.allowManualActual && (
            <Tooltip title="Record actual date"><Button type="text" size="small" icon={<CalendarOutlined />} onClick={() => onRecordActual(l)} /></Tooltip>
          )}
          {!l.actualDate && (
            <Tooltip title="Propose re-plan"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => onProposeReplan(l)} /></Tooltip>
          )}
        </Space>
      ),
    },
  ], [showBaseline, devVs, maxFloat, canAct, onRecordActual, onProposeReplan]);

  return (
    <div>
      <Space style={{ marginBottom: 10, flexWrap: 'wrap' }} size={16}>
        <Space size={6}><Switch size="small" checked={showBaseline} onChange={setShowBaseline} /><span style={{ fontSize: 12 }}>Baseline column</span></Space>
        <Space size={6}><Switch size="small" checked={criticalOnly} onChange={setCriticalOnly} /><span style={{ fontSize: 12 }}>Critical chain only</span></Space>
        <Space size={6}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Deviation vs</span>
          <Segmented size="small" value={devVs} onChange={setDevVs} options={[{ value: 'baseline', label: 'Baseline' }, { value: 'current plan', label: 'Current plan' }]} />
        </Space>
        <Tag color="default" style={{ fontSize: 11 }}><StarFilled style={{ color: 'var(--accent-color)' }} /> milestone</Tag>
      </Space>
      <Table
        rowKey="code"
        size="small"
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        scroll={{ x: 1180 }}
        onRow={(l) => (l.isCritical ? { style: { background: 'color-mix(in srgb, var(--error-color) 4%, transparent)' } } : {})}
      />
    </div>
  );
});

export default PlanGrid;
