import { useEffect, useMemo, useState } from 'react';
import { App, Form, Input, InputNumber, Select, Switch, Tag } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { getActiveFactories } from '../../../services/master/factoryService';
import { productionLineApi } from '../../../services/production/productionMasterApi';

const LINE_TYPES = [
  { value: 'SEWING', label: 'Sewing' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'CUTTING', label: 'Cutting' },
];

/** Sewing lines belong to a factory — the Unit select on every floor screen filters by it. */
const ProductionLineMaster = ({ onDirtyChange }) => {
  const { message } = App.useApp();
  const [factories, setFactories] = useState([]);

  useEffect(() => {
    getActiveFactories()
      .then(setFactories)
      .catch(() => message.error('Failed to load the factory list'));
  }, [message]);

  const factoryOptions = useMemo(
    () => factories.map((f) => ({ value: f.id, label: f.factoryName })),
    [factories],
  );

  const columns = useMemo(() => [
    { title: 'Line', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Unit', dataIndex: 'factoryName', width: 180, ellipsis: true, render: (v) => v || '—' },
    { title: 'Type', dataIndex: 'lineType', width: 110, render: (v) => <Tag>{v}</Tag> },
    { title: 'Operators', dataIndex: 'capacityOperators', width: 100, align: 'right', render: (v) => v ?? '—' },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Production Lines"
      subtitle="Sewing floor"
      noun="Line"
      api={productionLineApi}
      columns={columns}
      searchFields={['name', 'factoryName', 'lineType']}
      defaults={{ lineType: 'SEWING', active: true }}
      onDirtyChange={onDirtyChange}
      extraHeader="A line belongs to one unit; the floor screens filter lines by the unit chosen"
      renderFields={() => (
        <>
          <Form.Item name="name" label="Line Name" rules={[{ required: true, message: 'Enter the line name' }]}>
            <Input placeholder="e.g. Line-A" maxLength={50} />
          </Form.Item>
          <Form.Item name="factoryId" label="Unit (Factory)" rules={[{ required: true, message: 'Select the unit this line sits in' }]}>
            <Select placeholder="Select unit" options={factoryOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="lineType" label="Line Type" rules={[{ required: true, message: 'Select the line type' }]}>
            <Select options={LINE_TYPES} />
          </Form.Item>
          <Form.Item name="capacityOperators" label="Operator Capacity"
            tooltip="How many operators the line is laid out for; the plan can still ask for fewer">
            <InputNumber min={1} max={200} style={{ width: '100%' }} placeholder="e.g. 24" />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </>
      )}
    />
  );
};

export default ProductionLineMaster;
