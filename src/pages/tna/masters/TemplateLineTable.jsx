import { memo, useMemo } from 'react';
import { InputNumber, Select, Switch, Table, Tooltip } from 'antd';

const ROUTE_OPS = ['Embroidery', 'Printing', 'Washing'];

/** §7.3 — editable template activity lines: %LT, floors/ceilings, graph, alerts. */
const TemplateLineTable = memo(function TemplateLineTable({ lines, activities, onChange, readOnly }) {
  const codeOpts = useMemo(() => lines.map((l) => ({ value: l.code, label: l.code })), [lines]);
  const nameOf = useMemo(() => Object.fromEntries(activities.map((a) => [a.code, a.name])), [activities]);

  const patch = (code, part) => onChange(lines.map((l) => (l.code === code ? { ...l, ...part } : l)));
  const num = (code, key, min = 0) => (v) => patch(code, { [key]: Math.max(min, v ?? 0) });

  // Not memoised: cells close over the live `lines` array and the table is small.
  const columns = [
    { title: '#', width: 40, render: (_, __, i) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Activity', dataIndex: 'code', width: 210, render: (v) => <span><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{v}</span> <span style={{ fontSize: 12 }}>{nameOf[v]}</span></span> },
    {
      title: <Tooltip title="Zero or more; multiple predecessors resolve as the latest. Declared as activity references — never cell addresses.">Predecessors</Tooltip>,
      dataIndex: 'predecessors',
      width: 170,
      render: (v, l) => (readOnly ? (v.join(', ') || '—') : (
        <Select mode="multiple" size="small" style={{ width: '100%' }} value={v} options={codeOpts.filter((o) => o.value !== l.code)} onChange={(nv) => patch(l.code, { predecessors: nv })} />
      )),
    },
    { title: <Tooltip title="Percentage of leadtime allotted. Authored against the template's own critical path — parallel branches sum well above 100.">% of LT</Tooltip>, dataIndex: 'durationPct', width: 90, align: 'right', render: (v, l) => (readOnly ? `${v}%` : <InputNumber size="small" min={0} max={100} step={0.01} value={v} onChange={num(l.code, 'durationPct')} style={{ width: 80 }} />) },
    { title: 'Min', dataIndex: 'minDays', width: 66, align: 'right', render: (v, l) => (readOnly ? v : <InputNumber size="small" min={0} value={v} onChange={num(l.code, 'minDays')} style={{ width: 56 }} />) },
    { title: 'Max', dataIndex: 'maxDays', width: 66, align: 'right', render: (v, l) => (readOnly ? v : <InputNumber size="small" min={0} value={v} onChange={num(l.code, 'maxDays')} style={{ width: 56 }} />) },
    { title: <Tooltip title="Governed by physics or contract — never scales with leadtime">Fixed</Tooltip>, dataIndex: 'fixed', width: 60, align: 'center', render: (v, l) => <Switch size="small" checked={v} disabled={readOnly} onChange={(nv) => patch(l.code, { fixed: nv, ...(nv ? { maxDays: l.minDays, baseDays: l.minDays } : {}) })} /> },
    {
      title: <Tooltip title="Included only when the style's process route contains the operation">Route</Tooltip>,
      dataIndex: 'routeOperation',
      width: 130,
      render: (v, l) => (l.conditionalOnRoute ? (readOnly ? v : (
        <Select size="small" style={{ width: '100%' }} value={v} options={ROUTE_OPS.map((r) => ({ value: r, label: r }))} onChange={(nv) => patch(l.code, { routeOperation: nv })} />
      )) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Always</span>),
    },
    { title: <Tooltip title="Days before the planned date the due-soon reminder fires">Remind</Tooltip>, dataIndex: 'reminderLeadDays', width: 70, align: 'right', render: (v, l) => (readOnly ? `${v}d` : <InputNumber size="small" min={0} value={v} onChange={num(l.code, 'reminderLeadDays')} style={{ width: 56 }} />) },
    { title: <Tooltip title="Days past the planned date at which an unresolved activity escalates">Escalate</Tooltip>, dataIndex: 'escalationAfterDays', width: 74, align: 'right', render: (v, l) => (readOnly ? `${v}d` : <InputNumber size="small" min={0} value={v} onChange={num(l.code, 'escalationAfterDays')} style={{ width: 56 }} />) },
  ];

  return <Table rowKey="code" size="small" columns={columns} dataSource={lines} pagination={false} scroll={{ x: 1000, y: 420 }} />;
});

export default TemplateLineTable;
