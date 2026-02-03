import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag, Select } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockCategories = [
  { id: 1, name: 'Fabrics' },
  { id: 2, name: 'Trims' },
  { id: 3, name: 'Packaging' },
  { id: 4, name: 'Chemicals' },
];

const mockData = [
  { id: 1, categoryId: 1, name: 'Cotton', description: '100% Cotton', active: true },
  { id: 2, categoryId: 1, name: 'Polyester', description: 'Synthetic', active: true },
  { id: 3, categoryId: 2, name: 'Buttons', description: 'Plastic and Metal', active: true },
  { id: 4, categoryId: 2, name: 'Zippers', description: 'Nylon and Metal zippers', active: true },
];

const SubCategoryMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  const getCategoryName = (id) => mockCategories.find(c => c.id === id)?.name || 'Unknown';

  const columns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Category', dataIndex: 'categoryId', render: (id) => <Tag color="blue">{getCategoryName(id)}</Tag> },
    { title: 'Status', dataIndex: 'active', render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> },
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
      const newData = data.map(item => item.id === selectedId ? { ...item, ...values } : item);
      setData(newData);
      setFilteredData(newData);
      message.success('SubCategory updated successfully');
    } else {
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('SubCategory created successfully');
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
      getCategoryName(item.categoryId).toLowerCase().includes(lower)
    ));
  };

  return (
    <MasterSplitView
      title="Sub Categories"
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
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Sub Category' : 'New Sub Category'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
             <Form.Item name="categoryId" label="Parent Category" rules={[{ required: true, message: 'Please select a category' }]}>
              <Select placeholder="Select Category" size="large">
                {mockCategories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="name" label="Sub Category Name" rules={[{ required: true, message: 'Please enter name' }]}>
              <Input placeholder="e.g. Cotton" size="large" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={4} />
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

export default SubCategoryMaster;
