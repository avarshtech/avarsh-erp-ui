import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockData = [
  { id: 1, name: 'Raw Material', code: 'RM', description: 'Basic raw materials', active: true },
  { id: 2, name: 'Finished Good', code: 'FG', description: 'Ready for sale', active: true },
  { id: 3, name: 'Semi Finished', code: 'SF', description: 'Work in progress', active: true },
  { id: 4, name: 'Consumable', code: 'CN', description: 'Office supplies etc', active: true },
];

const ItemTypeMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: 'Code', dataIndex: 'code', render: (text) => <Tag color="geekblue">{text}</Tag> },
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
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
      message.success('Item Type updated');
    } else {
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('Item Type created');
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
      title="Item Types"
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
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Item Type' : 'New Item Type'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Type Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Raw Material" size="large"/>
            </Form.Item>
             <Form.Item name="code" label="Type Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. RM" style={{ width: '50%' }} />
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

export default ItemTypeMaster;
