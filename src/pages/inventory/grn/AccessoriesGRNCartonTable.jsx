import { useMemo } from 'react';
import { Table, Input, InputNumber, Select, Button, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import { INVENTORY_UOMS } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const AccessoriesGRNCartonTable = ({ cartons = [], onCartonChange, onAddCarton, onRemoveCarton }) => {
  const columns = useMemo(
    () => [
      {
        title: 'Carton #', dataIndex: 'cartonNumber', key: 'cartonNumber', width: 90,
        render: (_, __, i) => <Text strong>{`C${String(i + 1).padStart(3, '0')}`}</Text>,
      },
      {
        title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 140,
        render: (val, _, i) => <Input value={val} onChange={(e) => onCartonChange(i, 'itemCode', e.target.value)} placeholder="Item code" />,
      },
      {
        title: 'Description', dataIndex: 'itemDescription', key: 'itemDescription', width: 180,
        render: (val, _, i) => <Input value={val} onChange={(e) => onCartonChange(i, 'itemDescription', e.target.value)} placeholder="Item description" />,
      },
      {
        title: 'Color', dataIndex: 'color', key: 'color', width: 100,
        render: (val, _, i) => <Input value={val} onChange={(e) => onCartonChange(i, 'color', e.target.value)} placeholder="Color" />,
      },
      {
        title: 'Size', dataIndex: 'size', key: 'size', width: 80,
        render: (val, _, i) => <Input value={val} onChange={(e) => onCartonChange(i, 'size', e.target.value)} placeholder="Size" />,
      },
      {
        title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 100,
        render: (val, _, i) => <InputNumber value={val} onChange={(v) => onCartonChange(i, 'quantity', v)} style={{ width: '100%' }} min={0} {...numericInputProps} />,
      },
      {
        title: 'UOM', dataIndex: 'uom', key: 'uom', width: 100,
        render: (val, _, i) => <Select value={val} onChange={(v) => onCartonChange(i, 'uom', v)} style={{ width: '100%' }} options={INVENTORY_UOMS} placeholder="UOM" />,
      },
      {
        title: 'Batch/Lot', dataIndex: 'batchNo', key: 'batchNo', width: 120,
        render: (val, _, i) => <Input value={val} onChange={(e) => onCartonChange(i, 'batchNo', e.target.value)} placeholder="Batch" />,
      },
      {
        title: '', key: 'actions', width: 50, align: 'center',
        render: (_, __, i) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onRemoveCarton(i)} size="small" />,
      },
    ],
    [onCartonChange, onRemoveCarton],
  );

  const totalQty = useMemo(() => cartons.reduce((sum, c) => sum + (c.quantity || 0), 0), [cartons]);

  return (
    <>
      <Table
        rowKey={(_, i) => i}
        columns={columns}
        dataSource={cartons}
        pagination={false}
        scroll={{ x: 1100 }}
        size="small"
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={5}><Text strong>Total: {cartons.length} carton(s)</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1}><Text strong>{formatNumber(totalQty)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={4} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <Button type="dashed" icon={<PlusOutlined />} onClick={onAddCarton} style={{ width: '100%', marginTop: 12 }}>
        Add Carton
      </Button>
    </>
  );
};

export default AccessoriesGRNCartonTable;
