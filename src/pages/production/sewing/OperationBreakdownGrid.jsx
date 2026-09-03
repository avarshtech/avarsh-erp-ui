import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Input, Button, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, ImportOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { operationTargetPerHour, pitchOf, totalSamOf, operationRateTotal } from '../../../utils/sewingCalc';

/**
 * PRD 4.1.2 + 4.1.3 — operation breakdown with SAM per operation and a
 * line-balancing view: bar per operation vs pitch time (bottleneck SAM);
 * operations at the pitch are the constraint (red).
 */
const OperationBreakdownGrid = ({ plan, onChange, onLoadSamSheet }) => {
  const { operationOptions, machineOptions, operations: opMaster } = useSewingMasters();

  const setOp = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, operations: prev.operations.map((o, i) => (i === idx ? { ...o, [field]: val } : o)) }));
  }, [onChange]);

  /** Picking an operation pulls its default machine, as the server would. */
  const pickOperation = useCallback((idx, operationId) => {
    const master = opMaster.find((o) => o.id === operationId);
    onChange((prev) => ({
      ...prev,
      operations: prev.operations.map((o, i) => (i === idx
        ? { ...o, operationId, operation: master?.name, machineTypeId: o.machineTypeId ?? master?.machineTypeId }
        : o)),
    }));
  }, [onChange, opMaster]);

  const pitch = useMemo(() => pitchOf(plan.operations), [plan.operations]);
  const usedIds = useMemo(() => new Set(plan.operations.map((o) => o.operationId)), [plan.operations]);

  const columns = useMemo(() => [
    {
      title: 'Seq', dataIndex: 'seq', width: 70, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={1} value={v} style={{ width: 56 }} onChange={(val) => setOp(idx, 'seq', val)} />,
    },
    {
      title: 'Operation', dataIndex: 'operationId', width: 190,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 175 }} placeholder="Operation" showSearch optionFilterProp="label"
          options={operationOptions.map((o) => ({ ...o, disabled: usedIds.has(o.value) && o.value !== v }))}
          onChange={(val) => pickOperation(idx, val)} />
      ),
    },
    {
      title: 'Machine', dataIndex: 'machineTypeId', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }} placeholder="M/C"
          options={machineOptions} onChange={(val) => setOp(idx, 'machineTypeId', val)} />
      ),
    },
    {
      title: 'SAM (min)', dataIndex: 'sam', width: 100, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} step={0.1} value={v} style={{ width: 80 }} onChange={(val) => setOp(idx, 'sam', val)} />,
    },
    {
      title: 'Rate ₹/Op', dataIndex: 'rate', width: 95, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} step={0.1} value={v} style={{ width: 75 }} onChange={(val) => setOp(idx, 'rate', val)} />,
    },
    {
      title: 'Target/Hr', key: 'tph', width: 85, align: 'center',
      render: (_, r) => (r.sam ? <strong>{operationTargetPerHour(r.sam, plan.targetEfficiencyPct)}</strong> : '—'),
    },
    {
      title: `Line Balance (pitch ${pitch.toFixed(1)} min)`, key: 'bar', width: 260,
      render: (_, r) => {
        const sam = Number(r.sam) || 0;
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
  ], [pitch, plan.targetEfficiencyPct, setOp, onChange, operationOptions, machineOptions, usedIds, pickOperation]);

  return (
    <Card
      title="Operation Breakdown & Line Balancing"
      extra={(
        <Space>
          <Button icon={<ImportOutlined />} size="small" onClick={onLoadSamSheet}>Load from SAM Sheet</Button>
          <Button icon={<PlusOutlined />} size="small"
            onClick={() => onChange((prev) => ({
              ...prev,
              operations: [...prev.operations, { seq: prev.operations.length + 1, operationId: null, machineTypeId: null, sam: null, rate: null }],
            }))}>
            Add Operation
          </Button>
        </Space>
      )}
    >
      <Table rowKey={(r) => plan.operations.indexOf(r)} size="small" columns={columns} dataSource={plan.operations} pagination={false} scroll={{ x: 1000 }}
        locale={{ emptyText: 'Load the style’s SAM sheet, or add operations with SAM values — the balancing bars reveal the bottleneck' }}
        footer={() => (
          <Space size="large" wrap>
            <span>Total garment SAM: <strong>{totalSamOf(plan.operations).toFixed(2)} min</strong></span>
            <span>Σ Operation rates: <strong>₹{operationRateTotal(plan.operations).toFixed(2)}</strong></span>
            <span>Pitch (bottleneck): <strong>{pitch.toFixed(1)} min</strong></span>
            <span style={{ color: 'var(--text-secondary)' }}>Red bars exceed no other operation — rebalance by splitting work or adding an operator there.</span>
          </Space>
        )} />
    </Card>
  );
};

export default OperationBreakdownGrid;
