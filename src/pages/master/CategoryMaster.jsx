import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockData = [
  { id: 1, name: 'Fabrics', description: 'All types of fabrics', active: true },
  { id: 2, name: 'Trims', description: 'Buttons, Zippers, etc.', active: true },
  { id: 3, name: 'Packaging', description: 'Boxes, Bags, Tags', active: true },
  { id: 4, name: 'Chemicals', description: 'Dyes and chemicals', active: false },
];

const CategoryMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Name', dataIndex: 'name', width: '60%', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Status', dataIndex: 'active', width: '40%', render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> },
  ];

  const handleAdd = () => {
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true });
  };

  const handleSelect = (record) => {
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
  };

  const handleSave = (values) => {
    if (selectedId) {
      // Update
      const newData = data.map(item => item.id === selectedId ? { ...item, ...values } : item);
      setData(newData);
      setFilteredData(newData);
      message.success('Category updated successfully');
    } else {
      // Create
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('Category created successfully');
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
      (item.description && item.description.toLowerCase().includes(lower))
    ));
  };

  return (
    <MasterSplitView
      title="Categories"
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
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Category' : 'New Category'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Category Name" rules={[{ required: true, message: 'Please enter category name' }]}>
              <Input placeholder="e.g. Fabrics" size="large" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={4} placeholder="Description about the category..." />
            </Form.Item>
            <Form.Item name="active" label="Active Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Form>
        </div>
      )}
    />
  );
};

export default CategoryMaster;
