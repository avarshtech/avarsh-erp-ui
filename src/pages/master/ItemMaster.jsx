import React, { useState } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Switch, Space, message, Tag, Select, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const mockCategories = [
  { id: 1, name: 'Fabrics' },
  { id: 2, name: 'Trims' },
  { id: 3, name: 'Packaging' },
];

const mockSubCategories = [
  { id: 1, categoryId: 1, name: 'Cotton' },
  { id: 2, categoryId: 1, name: 'Polyester' },
  { id: 3, categoryId: 2, name: 'Buttons' },
];

const mockTypes = [
  { id: 1, name: 'Raw Material' },
  { id: 2, name: 'Finished Good' },
];

const mockUoms = [
  { id: 1, symbol: 'm' },
  { id: 2, symbol: 'kg' },
  { id: 3, symbol: 'pcs' },
];

const mockData = [
  { id: 1, name: 'Blue Cotton Fabric', sku: 'FAB-COT-BLU-001', typeId: 1, categoryId: 1, subCategoryId: 1, uomId: 1, price: 5.50, cost: 3.20, active: true },
  { id: 2, name: 'Wooden Button 20mm', sku: 'TRM-BTN-WDN-020', typeId: 1, categoryId: 2, subCategoryId: 3, uomId: 3, price: 0.15, cost: 0.05, active: true },
];

const ItemMaster = () => {
  const [data, setData] = useState(mockData);
  const [filteredData, setFilteredData] = useState(mockData);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  
  // Watch category to filter subcategories
  const [selectedCategory, setSelectedCategory] = useState(null);

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 120, render: (t) => <Tag>{t}</Tag> },
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Category', dataIndex: 'categoryId', width: 100, responsive: ['lg'], render: (id) => mockCategories.find(c => c.id === id)?.name },
    { title: 'Type', dataIndex: 'typeId', width: 100, responsive: ['xl'], render: (id) => mockTypes.find(t => t.id === id)?.name },
    { title: 'Status', dataIndex: 'active', width: 80, render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag> },
  ];

  const handleAdd = () => {
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true });
    setSelectedCategory(null);
  };

  const handleSelect = (record) => {
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(record);
    setSelectedCategory(record.categoryId);
  };

  const handleSave = (values) => {
    if (selectedId) {
      const newData = data.map(item => item.id === selectedId ? { ...item, ...values } : item);
      setData(newData);
      setFilteredData(newData);
      message.success('Item updated');
    } else {
      const newId = Math.max(...data.map(d => d.id), 0) + 1;
      const newItem = { id: newId, ...values };
      const newData = [...data, newItem];
      setData(newData);
      setFilteredData(newData);
      message.success('Item created');
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
      item.sku.toLowerCase().includes(lower)
    ));
  };
  
  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    form.setFieldsValue({ subCategoryId: null });
  };

  const filteredSubCategories = selectedCategory 
    ? mockSubCategories.filter(sc => sc.categoryId === selectedCategory) 
    : [];

  return (
    <MasterSplitView
      title="Item Master"
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
            <h2 style={{ margin: 0 }}>{selectedId ? 'Edit Item' : 'New Item'}</h2>
            <Space>
              <Button onClick={handleCancel} icon={<CloseOutlined />}>Cancel</Button>
              <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>Save Changes</Button>
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="sku" label="SKU / Item Code" rules={[{ required: true }]}>
                  <Input placeholder="e.g. ITEM-001" />
                </Form.Item>
              </Col>
              <Col span={12}>
                 <Form.Item name="typeId" label="Item Type" rules={[{ required: true }]}>
                  <Select placeholder="Select Type">
                    {mockTypes.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="name" label="Item Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Blue Cotton Fabric" size="large" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
                  <Select placeholder="Select Category" onChange={handleCategoryChange}>
                    {mockCategories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="subCategoryId" label="Sub Category">
                  <Select placeholder="Select Sub Category" disabled={!selectedCategory}>
                    {filteredSubCategories.map(sc => <Select.Option key={sc.id} value={sc.id}>{sc.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                 <Form.Item name="uomId" label="UOM" rules={[{ required: true }]}>
                  <Select placeholder="Unit">
                    {mockUoms.map(u => <Select.Option key={u.id} value={u.id}>{u.symbol}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="cost" label="Cost Price">
                  <InputNumber style={{ width: '100%' }} prefix="$" min={0} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="price" label="Selling Price">
                  <InputNumber style={{ width: '100%' }} prefix="$" min={0} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} />
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

export default ItemMaster;
