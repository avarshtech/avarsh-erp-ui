import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag, Select } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockData = [
  { id: 1, name: 'Color', code: 'CLR', values: ['Red', 'Blue', 'Green', 'Black', 'White'], active: true },
  { id: 2, name: 'Size', code: 'SZ', values: ['S', 'M', 'L', 'XL', 'XXL'], active: true },
  { id: 3, name: 'Material', code: 'MAT', values: ['Cotton', 'Polyester', 'Silk'], active: true },
];

const VariantMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Code', dataIndex: 'code', render: (text) => <Tag>{text}</Tag> },
    { title: 'Values', dataIndex: 'values', render: (vals) => (
      <div style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {vals.join(', ')}
      </div>
    )},
    { title: 'Status', dataIndex: 'active', render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> },
  ];

  const handleAdd = () => {
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true, values: [] });
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
      message.success('Variant updated');
    } else {
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('Variant created');
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
      item.code.toLowerCase().includes(lower)
    ));
  };

  return (
    <MasterSplitView
      title="Variants / Attributes"
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
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Variant' : 'New Variant'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Variant Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Color" size="large" />
            </Form.Item>
             <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. CLR" style={{ width: '50%' }} />
            </Form.Item>
            <Form.Item name="values" label="Attribute Values">
              <Select mode="tags" placeholder="Type and press enter to add values" style={{ width: '100%' }} tokenSeparators={[',']} />
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

export default VariantMaster;
