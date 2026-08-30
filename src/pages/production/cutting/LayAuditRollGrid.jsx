import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Input, Button, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { formatNumber } from '../../../utils/formatters';

/**
 * FR-03 roll grid — Total = #Lays × Weight/Lay; Variance = Total − Roll Weight.
 * UOM follows the fabric category: kg for knits, metres for woven/denim.
 * (positive ⇒ shortage in red, negative ⇒ excess left on roll in green).
 */
const LayAuditRollGrid = ({ lay, availableRolls, uom = 'kg', onChange }) => {
  const setRoll = useCallback((idx, field, val) => {
    onChange((prev) => ({
      ...prev,
      rolls: prev.rolls.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    }));
  }, [onChange]);

  const pickRoll = useCallback((idx, rollNo, rollsAvail) => {
    const src = rollsAvail.find((r) => r.rollNo === rollNo);
    onChange((prev) => ({
      ...prev,
      rolls: prev.rolls.map((r, i) => (i === idx ? { ...r, rollNo, weight: src?.weight ?? null } : r)),
    }));
  }, [onChange]);

  const rows = useMemo(() => lay.rolls.map((r) => {
    const total = Math.round((r.numLays || 0) * (r.weightPerLay || 0) * 1000) / 1000;
    return { ...r, total, variance: Math.round((total - (r.weight || 0)) * 1000) / 1000 };
  }), [lay.rolls]);

  const usedRollNos = useMemo(() => new Set(lay.rolls.map((r) => r.rollNo)), [lay.rolls]);

  const columns = useMemo(() => [
    {
      title: 'Roll #', dataIndex: 'rollNo', width: 170,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 150 }} placeholder="Relaxed roll"
          options={availableRolls.map((r) => ({
            value: r.rollNo, disabled: !r.relaxed || (usedRollNos.has(r.rollNo) && r.rollNo !== v),
            label: `${r.rollNo} · ${r.shadeLot}${r.relaxed ? '' : ' (not relaxed)'}`,
          }))}
          onChange={(val) => pickRoll(idx, val, availableRolls)} />
      ),
    },
    { title: 'Roll Weight', dataIndex: 'weight', width: 120, align: 'right', render: (v) => (v != null ? `${formatNumber(v, 3)} ${uom}` : '—') },
    {
      title: `Weight / Lay (${uom})`, dataIndex: 'weightPerLay', width: 130, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} step={0.01} value={v} style={{ width: 100 }} onChange={(val) => setRoll(idx, 'weightPerLay', val)} />,
    },
    {
      title: '# of Lays', dataIndex: 'numLays', width: 100, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 80 }} onChange={(val) => setRoll(idx, 'numLays', val)} />,
    },
    { title: 'Total Lay Weight', dataIndex: 'total', width: 130, align: 'right', render: (v) => <strong>{formatNumber(v, 3)} {uom}</strong> },
    {
      title: 'Short / Excess', dataIndex: 'variance', width: 120, align: 'right',
      render: (v) => (
        <Tooltip title={v > 0 ? 'Shortage — more fabric consumed than the roll held' : 'Excess — fabric left over on the roll'}>
          <span style={{ color: v > 0 ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{formatNumber(v, 3)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 200,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setRoll(idx, 'remarks', e.target.value)} />,
    },
    {
      title: '', key: 'del', width: 50, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, rolls: prev.rolls.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [availableRolls, usedRollNos, uom, pickRoll, setRoll, onChange]);

  const totals = useMemo(() => ({
    used: rows.reduce((s, r) => s + r.total, 0),
    variance: rows.reduce((s, r) => s + r.variance, 0),
    lays: rows.reduce((s, r) => s + (r.numLays || 0), 0),
  }), [rows]);

  return (
    <Card
      title="Rolls in this Lay"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({ ...prev, rolls: [...prev.rolls, { rollNo: null, weight: null, weightPerLay: null, numLays: null, remarks: '' }] }))}>
          Add Roll
        </Button>
      )}
    >
      <Table rowKey={(r) => rows.indexOf(r)} size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1000 }}
        locale={{ emptyText: 'Only rolls with completed relaxation can be added' }}
        footer={() => (
          <Space size="large">
            <span>Total height: <strong>{totals.lays}</strong></span>
            <span>Total weight used: <strong>{formatNumber(totals.used, 3)} {uom}</strong></span>
            <span>Net variance: <strong style={{ color: totals.variance > 0 ? 'var(--error-color)' : 'var(--success-color)' }}>{formatNumber(totals.variance, 3)} {uom}</strong></span>
          </Space>
        )} />
    </Card>
  );
};

export default LayAuditRollGrid;
