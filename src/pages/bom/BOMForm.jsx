import { useState } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Table,
  Space,
  Typography,
  message,
  Popconfirm,
  Collapse,
  Tag,
  Tabs,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  SkinOutlined,
  ToolOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { hasPermission } from '../../utils/permissions';

const { Title, Text } = Typography;
const { TextArea } = Input;

const BOMForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('fabric');

  const [materials, setMaterials] = useState({
    fabric: [
      { key: '1', name: '', specification: '', consumption: 0, wastage: 5, unit: 'meters', rate: 0, amount: 0 },
    ],
    trims: [
      { key: '1', name: '', specification: '', quantity: 0, unit: 'pcs', rate: 0, amount: 0 },
    ],
    accessories: [
      { key: '1', name: '', specification: '', quantity: 0, unit: 'pcs', rate: 0, amount: 0 },
    ],
    packing: [
      { key: '1', name: '', specification: '', quantity: 0, unit: 'pcs', rate: 0, amount: 0 },
    ],
  });

  const categories = [
    { value: 'shirts', label: 'Shirts' },
    { value: 'dresses', label: 'Dresses' },
    { value: 'pants', label: 'Pants' },
    { value: 'kids-wear', label: 'Kids Wear' },
    { value: 'denim', label: 'Denim' },
  ];

  const units = [
    { value: 'meters', label: 'Meters' },
    { value: 'yards', label: 'Yards' },
    { value: 'kgs', label: 'Kgs' },
    { value: 'pcs', label: 'Pieces' },
    { value: 'sets', label: 'Sets' },
    { value: 'pairs', label: 'Pairs' },
  ];

  const fabricOptions = [
    { value: 'cotton-40s', label: 'Cotton 40s' },
    { value: 'cotton-60s', label: 'Cotton 60s' },
    { value: 'polyester', label: 'Polyester' },
    { value: 'poly-cotton', label: 'Poly-Cotton Blend' },
    { value: 'linen', label: 'Linen' },
    { value: 'denim', label: 'Denim Fabric' },
  ];

  const trimOptions = [
    { value: 'thread', label: 'Sewing Thread' },
    { value: 'buttons', label: 'Buttons' },
    { value: 'zipper', label: 'Zipper' },
    { value: 'interlining', label: 'Interlining' },
    { value: 'labels', label: 'Labels' },
    { value: 'elastic', label: 'Elastic' },
  ];

  const handleAddMaterial = (type) => {
    const newKey = String(materials[type].length + 1);
    const newItem = type === 'fabric'
      ? { key: newKey, name: '', specification: '', consumption: 0, wastage: 5, unit: 'meters', rate: 0, amount: 0 }
      : { key: newKey, name: '', specification: '', quantity: 0, unit: 'pcs', rate: 0, amount: 0 };
    
    setMaterials({
      ...materials,
      [type]: [...materials[type], newItem],
    });
  };

  const handleRemoveMaterial = (type, key) => {
    if (materials[type].length === 1) {
      message.warning('At least one item is required');
      return;
    }
    setMaterials({
      ...materials,
      [type]: materials[type].filter((item) => item.key !== key),
    });
  };

  const handleMaterialChange = (type, key, field, value) => {
    setMaterials({
      ...materials,
      [type]: materials[type].map((item) => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          if (type === 'fabric') {
            const consumption = updated.consumption || 0;
            const wastage = updated.wastage || 0;
            const rate = updated.rate || 0;
            updated.amount = consumption * (1 + wastage / 100) * rate;
          } else {
            updated.amount = (updated.quantity || 0) * (updated.rate || 0);
          }
          return updated;
        }
        return item;
      }),
    });
  };

  const getTotalCost = () => {
    let total = 0;
    Object.values(materials).forEach((items) => {
      items.forEach((item) => {
        total += item.amount || 0;
      });
    });
    return total;
  };

  const fabricColumns = [
    { title: '#', width: 50, render: (_, __, index) => index + 1 },
    {
      title: 'Fabric Name',
      dataIndex: 'name',
      width: 180,
      render: (value, record) => (
        <Select
          placeholder="Select fabric"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleMaterialChange('fabric', record.key, 'name', v)}
          options={fabricOptions}
          showSearch
        />
      ),
    },
    {
      title: 'Specification',
      dataIndex: 'specification',
      width: 150,
      render: (value, record) => (
        <Input
          placeholder="e.g., 58 inch width"
          value={value}
          onChange={(e) => handleMaterialChange('fabric', record.key, 'specification', e.target.value)}
        />
      ),
    },
    {
      title: 'Consumption',
      dataIndex: 'consumption',
      width: 110,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange('fabric', record.key, 'consumption', v)}
        />
      ),
    },
    {
      title: 'Wastage %',
      dataIndex: 'wastage',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={50}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange('fabric', record.key, 'wastage', v)}
        />
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 100,
      render: (value, record) => (
        <Select
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange('fabric', record.key, 'unit', v)}
          options={units}
        />
      ),
    },
    {
      title: 'Rate ($)',
      dataIndex: 'rate',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange('fabric', record.key, 'rate', v)}
        />
      ),
    },
    {
      title: 'Amount ($)',
      dataIndex: 'amount',
      width: 110,
      render: (value) => (
        <Text strong style={{ color: '#10b981' }}>
          ${(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, record) => (
        <Popconfirm title="Remove?" onConfirm={() => handleRemoveMaterial('fabric', record.key)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const createTrimsColumns = (type) => [
    { title: '#', width: 50, render: (_, __, index) => index + 1 },
    {
      title: 'Item Name',
      dataIndex: 'name',
      width: 180,
      render: (value, record) => (
        <Select
          placeholder="Select item"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleMaterialChange(type, record.key, 'name', v)}
          options={trimOptions}
          showSearch
        />
      ),
    },
    {
      title: 'Specification',
      dataIndex: 'specification',
      width: 180,
      render: (value, record) => (
        <Input
          placeholder="e.g., 20mm, White"
          value={value}
          onChange={(e) => handleMaterialChange(type, record.key, 'specification', e.target.value)}
        />
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange(type, record.key, 'quantity', v)}
        />
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 100,
      render: (value, record) => (
        <Select
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange(type, record.key, 'unit', v)}
          options={units}
        />
      ),
    },
    {
      title: 'Rate ($)',
      dataIndex: 'rate',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleMaterialChange(type, record.key, 'rate', v)}
        />
      ),
    },
    {
      title: 'Amount ($)',
      dataIndex: 'amount',
      width: 110,
      render: (value) => (
        <Text strong style={{ color: '#10b981' }}>
          ${(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, record) => (
        <Popconfirm title="Remove?" onConfirm={() => handleRemoveMaterial(type, record.key)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'fabric',
      label: (
        <span>
          <SkinOutlined /> Fabric
        </span>
      ),
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddMaterial('fabric')}>
              Add Fabric
            </Button>
          </div>
          <Table
            columns={fabricColumns}
            dataSource={materials.fabric}
            pagination={false}
            scroll={{ x: 1000 }}
            size="middle"
          />
        </>
      ),
    },
    {
      key: 'trims',
      label: (
        <span>
          <ToolOutlined /> Trims
        </span>
      ),
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddMaterial('trims')}>
              Add Trim
            </Button>
          </div>
          <Table
            columns={createTrimsColumns('trims')}
            dataSource={materials.trims}
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
          />
        </>
      ),
    },
    {
      key: 'accessories',
      label: (
        <span>
          <AppstoreOutlined /> Accessories
        </span>
      ),
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddMaterial('accessories')}>
              Add Accessory
            </Button>
          </div>
          <Table
            columns={createTrimsColumns('accessories')}
            dataSource={materials.accessories}
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
          />
        </>
      ),
    },
    {
      key: 'packing',
      label: (
        <span>
          <SafetyOutlined /> Packing
        </span>
      ),
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddMaterial('packing')}>
              Add Packing Item
            </Button>
          </div>
          <Table
            columns={createTrimsColumns('packing')}
            dataSource={materials.packing}
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
          />
        </>
      ),
    },
  ];

  const handleSubmit = (values) => {
    const bomData = {
      ...values,
      materials,
      totalCost: getTotalCost(),
    };
    console.log('BOM Data:', bomData);
    message.success('BOM saved successfully!');
    navigate('/bom/list');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bom/list')} />
          <h1>{id ? 'Edit BOM' : 'Create Bill of Materials'}</h1>
        </Space>
        <div className="header-actions">
          {hasPermission('bom', id ? 'update' : 'add') && (
            <Button icon={<SaveOutlined />}>Save as Draft</Button>
          )}
          {hasPermission('bom', id ? 'update' : 'add') && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => form.submit()}>
              Save & Approve
            </Button>
          )}
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {/* Style Information */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 24 }}>Style Information</Title>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="styleName"
                label="Style Name"
                rules={[{ required: true, message: 'Please enter style name' }]}
              >
                <Input placeholder="Enter style name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="styleCode"
                label="Style Code"
                rules={[{ required: true, message: 'Please enter style code' }]}
              >
                <Input placeholder="e.g., MCS-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category" options={categories} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item name="season" label="Season">
                <Select
                  placeholder="Select season"
                  options={[
                    { value: 'ss24', label: 'Spring/Summer 2024' },
                    { value: 'aw24', label: 'Autumn/Winter 2024' },
                    { value: 'ss25', label: 'Spring/Summer 2025' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="description" label="Description">
                <TextArea rows={2} placeholder="Brief description of the style" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Materials */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>Materials & Components</Title>
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
              Total Cost: <strong>${getTotalCost().toFixed(2)}</strong> / Unit
            </Tag>
          </div>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Card>

        {/* Cost Summary */}
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Cost Summary</Title>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 4 }} items={[
            {
              key: 'fabric',
              label: 'Fabric Cost',
              children: `$${materials.fabric.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}`,
            },
            {
              key: 'trims',
              label: 'Trims Cost',
              children: `$${materials.trims.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}`,
            },
            {
              key: 'accessories',
              label: 'Accessories Cost',
              children: `$${materials.accessories.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}`,
            },
            {
              key: 'packing',
              label: 'Packing Cost',
              children: `$${materials.packing.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}`,
            },
          ]} />
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Text style={{ fontSize: 18 }}>Total Estimated Cost: </Text>
            <Text strong style={{ fontSize: 24, color: '#6366f1' }}>
              ${getTotalCost().toFixed(2)} / Unit
            </Text>
          </div>
        </Card>
      </Form>
    </div>
  );
};

export default BOMForm;
