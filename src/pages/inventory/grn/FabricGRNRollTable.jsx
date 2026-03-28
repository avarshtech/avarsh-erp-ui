import { useMemo } from 'react';
import { Table, Input, InputNumber, Button, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const FabricGRNRollTable = ({ rolls = [], onRollChange, onAddRoll, onRemoveRoll }) => {
  const columns = useMemo(
    () => [
      { title: '#', width: 50, render: (_, __, i) => i + 1, key: 'index' },
      {
        title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber', width: 100,
        render: (_, __, i) => <Text strong>{`R${String(i + 1).padStart(3, '0')}`}</Text>,
      },
      {
        title: 'Fabric Description', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 200,
        render: (val, _, i) => <Input value={val} onChange={(e) => onRollChange(i, 'fabricDescription', e.target.value)} placeholder="Fabric description" />,
      },
      {
        title: 'Width (in)', dataIndex: 'width', key: 'width', width: 100,
        render: (val, _, i) => <InputNumber value={val} onChange={(v) => onRollChange(i, 'width', v)} style={{ width: '100%' }} placeholder="Inches" {...numericInputProps} />,
      },
      {
        title: 'Weight (kg)', dataIndex: 'weight', key: 'weight', width: 110,
        render: (val, _, i) => <InputNumber value={val} onChange={(v) => onRollChange(i, 'weight', v)} style={{ width: '100%' }} placeholder="Kg" {...numericInputProps} />,
      },
      {
        title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', width: 120,
        render: (val, _, i) => <Input value={val} onChange={(e) => onRollChange(i, 'shadeLot', e.target.value)} placeholder="SL-001" />,
      },
      {
        title: 'GSM', dataIndex: 'gsm', key: 'gsm', width: 90,
        render: (val, _, i) => <InputNumber value={val} onChange={(v) => onRollChange(i, 'gsm', v)} style={{ width: '100%' }} {...numericInputProps} />,
      },
      {
        title: '', key: 'actions', width: 50, align: 'center',
        render: (_, __, i) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onRemoveRoll(i)} size="small" />,
      },
    ],
    [onRollChange, onRemoveRoll],
  );

  const totalWeight = useMemo(() => rolls.reduce((sum, r) => sum + (r.weight || 0), 0), [rolls]);

  return (
    <>
      <Table
        rowKey={(_, i) => i}
        columns={columns}
        dataSource={rolls}
        pagination={false}
        scroll={{ x: 900 }}
        size="small"
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Total: {rolls.length} roll(s)</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1}><Text strong>{formatNumber(totalWeight, 1)} kg</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={3} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <Button type="dashed" icon={<PlusOutlined />} onClick={onAddRoll} style={{ width: '100%', marginTop: 12 }}>
        Add Roll
      </Button>
    </>
  );
};

export default FabricGRNRollTable;
