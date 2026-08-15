import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, DatePicker, Input, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { CUTTING_TABLES } from '../../../utils/cuttingConstants';

/** COP editable size-color matrix + cut schedule (child of CutOrderPlanForm). */
const CopMatrixAndSchedule = ({ cop, po, onChange }) => {
  const sizes = useMemo(() => po?.sizes || [], [po?.sizes]);

  const setMatrixQty = useCallback((rowIdx, size, val) => {
    onChange((prev) => ({
      ...prev,
      matrix: prev.matrix.map((row, i) => (i === rowIdx ? { ...row, qty: { ...row.qty, [size]: val || 0 } } : row)),
    }));
  }, [onChange]);

  const setSchedule = useCallback((rowIdx, field, val) => {
    onChange((prev) => ({
      ...prev,
      schedule: prev.schedule.map((row, i) => (i === rowIdx ? { ...row, [field]: val } : row)),
    }));
  }, [onChange]);

  const matrixColumns = useMemo(() => [
    { title: 'Color', dataIndex: 'color', width: 140, fixed: 'left' },
    ...sizes.map((size) => ({
      title: size, key: size, width: 100, align: 'center',
      render: (_, row, idx) => (
        <InputNumber size="small" min={0} value={row.qty[size]} style={{ width: 84 }}
          onChange={(v) => setMatrixQty(idx, size, v)} />
      ),
    })),
    {
      title: 'Total', key: 'total', width: 90, align: 'right',
      render: (_, row) => <strong>{Object.values(row.qty).reduce((s, v) => s + (v || 0), 0)}</strong>,
    },
  ], [sizes, setMatrixQty]);

  const scheduleColumns = useMemo(() => [
    {
      title: 'Date', dataIndex: 'date', width: 150,
      render: (v, _, idx) => (
        <DatePicker size="small" format="DD-MMM-YYYY" value={v ? dayjs(v) : null} allowClear={false}
          onChange={(d) => setSchedule(idx, 'date', d.format('YYYY-MM-DD'))} />
      ),
    },
    {
      title: 'Table', dataIndex: 'table', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 110 }}
          options={CUTTING_TABLES.map((t) => ({ value: t, label: t }))}
          onChange={(val) => setSchedule(idx, 'table', val)} />
      ),
    },
    { title: 'Color', dataIndex: 'color', width: 130 },
    {
      title: 'Marker Ref', dataIndex: 'markerRef', width: 200,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setSchedule(idx, 'markerRef', e.target.value)} />,
    },
    {
      title: 'Planned Plies', dataIndex: 'plannedPlies', width: 120, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={1} value={v} style={{ width: 90 }} onChange={(val) => setSchedule(idx, 'plannedPlies', val)} />,
    },
    {
      title: 'Planned Qty', dataIndex: 'plannedQty', width: 120, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={1} value={v} style={{ width: 90 }} onChange={(val) => setSchedule(idx, 'plannedQty', val)} />,
    },
    {
      title: '', key: 'del', width: 50, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, schedule: prev.schedule.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [setSchedule, onChange]);

  const addScheduleRow = useCallback(() => {
    onChange((prev) => ({
      ...prev,
      schedule: [...prev.schedule, { date: dayjs().format('YYYY-MM-DD'), table: CUTTING_TABLES[0], color: prev.matrix[0]?.color, markerRef: '', plannedPlies: null, plannedQty: null }],
    }));
  }, [onChange]);

  return (
    <>
      <Card title="Size-Color Matrix" style={{ marginBottom: 16 }}>
        <Table rowKey="color" size="small" columns={matrixColumns} dataSource={cop.matrix} pagination={false} scroll={{ x: 700 }} />
      </Card>
      <Card
        title="Cut Schedule"
        extra={<Button icon={<PlusOutlined />} size="small" onClick={addScheduleRow}>Add Lay</Button>}
      >
        <Table rowKey={(r) => cop.schedule.indexOf(r)} size="small" columns={scheduleColumns} dataSource={cop.schedule} pagination={false}
          scroll={{ x: 950 }} locale={{ emptyText: 'No lays scheduled yet — add planned lays per marker' }}
          footer={() => (
            <Space size="large">
              <span>Planned total: <strong>{cop.schedule.reduce((s, r) => s + (r.plannedQty || 0), 0)}</strong></span>
              <span>Order qty: <strong>{po?.orderQty ?? '—'}</strong></span>
            </Space>
          )} />
      </Card>
    </>
  );
};

export default CopMatrixAndSchedule;
