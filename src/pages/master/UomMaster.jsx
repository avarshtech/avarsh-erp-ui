import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag, InputNumber } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockData = [
  { id: 1, name: 'Kilogram', symbol: 'kg', precision: 2, active: true },
  { id: 2, name: 'Meter', symbol: 'm', precision: 2, active: true },
  { id: 3, name: 'Pieces', symbol: 'pcs', precision: 0, active: true },
  { id: 4, name: 'Liter', symbol: 'l', precision: 3, active: true },
];

const UomMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Symbol', dataIndex: 'symbol', width: 80, render: (text) => <Tag color="orange">{text}</Tag> },
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Status', dataIndex: 'active', render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> },
  ];

  const handleAdd = () => {
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true, precision: 2 });
  };

  const handleSelect = (record) => {
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
  };

  const handleSave = (values) => {
    if (selectedId) {
      const newData = data.map(item => item.id === selectedId ? { ...item, ...values } : item);
      setData(newData);
      setFilteredData(newData);
      message.success('UOM updated');
    } else {
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('UOM created');
      setSelectedId(newId);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(data.filter(item => 
      item.name.toLowerCase().includes(lower) || 
      item.symbol.toLowerCase().includes(lower)
    ));
  };

  return (
    <MasterSplitView
      title="Unit of Measure"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={handleAdd}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      renderForm={() => (
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit UOM' : 'New UOM'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="UOM Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Kilogram" size="large" />
            </Form.Item>
             <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
              <Input placeholder="e.g. kg" style={{ width: '50%' }} />
            </Form.Item>
            <Form.Item name="precision" label="Decimal Precision">
              <InputNumber min={0} max={6} style={{ width: '50%' }} />
            </Form.Item>
            <Form.Item name="active" label="Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Form>
        </div>
      )}
    />
  );
};

export default UomMaster;
