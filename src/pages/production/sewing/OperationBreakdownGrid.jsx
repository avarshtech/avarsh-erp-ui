import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Input, Button, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { MACHINE_TYPES } from '../../../utils/sewingConstants';

/**
 * PRD 4.1.2 + 4.1.3 — operation breakdown with SAM per operation and a
 * line-balancing view: bar per operation vs pitch time (bottleneck SAM);
 * operations at the pitch are the constraint (red).
 */
const OperationBreakdownGrid = ({ plan, operators, onChange }) => {
  const setOp = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, operations: prev.operations.map((o, i) => (i === idx ? { ...o, [field]: val } : o)) }));
  }, [onChange]);

  const pitch = useMemo(() => Math.max(0, ...plan.operations.map((o) => o.sam || 0)), [plan.operations]);

  const columns = useMemo(() => [
    {
      title: 'Seq', dataIndex: 'seq', width: 70, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={1} value={v} style={{ width: 56 }} onChange={(val) => setOp(idx, 'seq', val)} />,
    },
    {
      title: 'Operation', dataIndex: 'operation', width: 180,
      render: (v, _, idx) => <Input size="small" value={v} placeholder="e.g. Shoulder join" onChange={(e) => setOp(idx, 'operation', e.target.value)} />,
    },
    {
      title: 'Machine', dataIndex: 'machine', width: 120,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 105 }} placeholder="M/C"
          options={MACHINE_TYPES.map((m) => ({ value: m, label: m }))} onChange={(val) => setOp(idx, 'machine', val)} />
      ),
    },
    {
      title: 'SAM (min)', dataIndex: 'sam', width: 100, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} step={0.1} value={v} style={{ width: 80 }} onChange={(val) => setOp(idx, 'sam', val)} />,
    },
    {
      title: 'Assigned Operator', dataIndex: 'operatorId', width: 170,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Operator"
          options={operators.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
          onChange={(val) => setOp(idx, 'operatorId', val)} />
      ),
    },
    {
      title: 'Rate ₹/Op', dataIndex: 'rate', width: 95, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} step={0.1} value={v} style={{ width: 75 }} onChange={(val) => setOp(idx, 'rate', val)} />,
    },
    {
      title: 'Target/Hr', key: 'tph', width: 85, align: 'center',
      render: (_, r) => (r.sam ? <strong>{Math.round((60 / r.sam) * ((plan.targetEfficiencyPct || 100) / 100))}</strong> : '—'),
    },
    {
      title: `Line Balance (pitch ${pitch.toFixed(1)} min)`, key: 'bar', width: 260,
      render: (_, r) => {
        const sam = r.sam || 0;
        const pct = pitch ? Math.round((sam / pitch) * 100) : 0;
        const isBottleneck = pitch > 0 && sam >= pitch;
        return (
          <Tooltip title={isBottleneck ? 'Bottleneck operation — sets the line pitch' : `${pct}% of pitch time`}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: isBottleneck ? 'var(--error-color)' : pct >= 80 ? 'var(--warning-color)' : 'var(--success-color)',
              }} />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, operations: prev.operations.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [operators, pitch, plan.targetEfficiencyPct, setOp, onChange]);

  return (
    <Card
      title="Operation Breakdown & Line Balancing"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({ ...prev, operations: [...prev.operations, { seq: prev.operations.length + 1, operation: '', machine: null, sam: null, operatorId: null, rate: null }] }))}>
          Add Operation
        </Button>
      )}
    >
      <Table rowKey={(r) => plan.operations.indexOf(r)} size="small" columns={columns} dataSource={plan.operations} pagination={false} scroll={{ x: 950 }}
        locale={{ emptyText: 'Add operations with SAM values — the balancing bars reveal the bottleneck' }}
        footer={() => (
          <Space size="large">
            <span>Total garment SAM: <strong>{plan.operations.reduce((s, o) => s + (o.sam || 0), 0).toFixed(1)} min</strong></span>
            <span>Σ Operation rates: <strong>₹{plan.operations.reduce((s, o) => s + (o.rate || 0), 0).toFixed(2)}</strong></span>
            <span>Pitch (bottleneck): <strong>{pitch.toFixed(1)} min</strong></span>
            <span style={{ color: 'var(--text-secondary)' }}>Red bars exceed no other operation — rebalance by splitting work or adding an operator there.</span>
          </Space>
        )} />
    </Card>
  );
};

export default OperationBreakdownGrid;
