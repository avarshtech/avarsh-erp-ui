import { useState } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Tag,
  Dropdown,
  Typography,
  Tooltip,
  Modal,
  message,
  Select,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CopyOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const { Text } = Typography;

const BOMList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const boms = [
    {
      key: '1',
      bomId: 'BOM-2024-0001',
      styleName: 'Men\'s Casual Shirts',
      styleCode: 'MCS-001',
      version: '1.2',
      category: 'Shirts',
      totalMaterials: 12,
      estimatedCost: 8.50,
      status: 'Active',
      createdDate: '2024-01-15',
      lastModified: '2024-01-28',
      completeness: 100,
    },
    {
      key: '2',
      bomId: 'BOM-2024-0002',
      styleName: 'Women\'s Summer Dresses',
      styleCode: 'WSD-002',
      version: '1.0',
      category: 'Dresses',
      totalMaterials: 18,
      estimatedCost: 12.75,
      status: 'Active',
      createdDate: '2024-01-20',
      lastModified: '2024-01-27',
      completeness: 95,
    },
    {
      key: '3',
      bomId: 'BOM-2024-0003',
      styleName: 'Children\'s T-Shirts',
      styleCode: 'CTS-003',
      version: '2.0',
      category: 'Kids Wear',
      totalMaterials: 8,
      estimatedCost: 4.25,
      status: 'Draft',
      createdDate: '2024-01-22',
      lastModified: '2024-01-26',
      completeness: 60,
    },
    {
      key: '4',
      bomId: 'BOM-2024-0004',
      styleName: 'Premium Polo Shirts',
      styleCode: 'PPS-004',
      version: '1.1',
      category: 'Shirts',
      totalMaterials: 15,
      estimatedCost: 14.00,
      status: 'Active',
      createdDate: '2024-01-10',
      lastModified: '2024-01-25',
      completeness: 100,
    },
    {
      key: '5',
      bomId: 'BOM-2024-0005',
      styleName: 'Slim Fit Jeans',
      styleCode: 'SFJ-005',
      version: '1.0',
      category: 'Denim',
      totalMaterials: 20,
      estimatedCost: 18.50,
      status: 'Pending Approval',
      createdDate: '2024-01-24',
      lastModified: '2024-01-28',
      completeness: 85,
    },
  ];

  const statusColors = {
    'Active': 'green',
    'Draft': 'default',
    'Pending Approval': 'gold',
    'Archived': 'red',
  };

  const columns = [
    {
      title: 'BOM ID',
      dataIndex: 'bomId',
      key: 'bomId',
      fixed: 'left',
      width: 140,
      render: (text) => (
        <Text strong style={{ color: '#6366f1', cursor: 'pointer' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Style',
      key: 'style',
      width: 220,
      render: (_, record) => (
        <div>
          <Text strong>{record.styleName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.styleCode}
          </Text>
        </div>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center',
      render: (v) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: 'Materials',
      dataIndex: 'totalMaterials',
      key: 'totalMaterials',
      width: 100,
      align: 'center',
      render: (count) => (
        <Space>
          <FileTextOutlined />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: 'Est. Cost/Unit',
      dataIndex: 'estimatedCost',
      key: 'estimatedCost',
      width: 130,
      align: 'right',
      render: (cost) => (
        <Text strong style={{ color: '#10b981' }}>
          ${cost.toFixed(2)}
        </Text>
      ),
      sorter: (a, b) => a.estimatedCost - b.estimatedCost,
    },
    {
      title: 'Completeness',
      dataIndex: 'completeness',
      key: 'completeness',
      width: 140,
      render: (percent) => (
        <Progress
          percent={percent}
          size="small"
          strokeColor={percent === 100 ? '#22c55e' : percent >= 80 ? '#f59e0b' : '#ef4444'}
        />
      ),
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      key: 'lastModified',
      width: 120,
      sorter: (a, b) => new Date(a.lastModified) - new Date(b.lastModified),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      fixed: 'right',
      render: (status) => (
        <Tag color={statusColors[status]} style={{ borderRadius: 20 }}>
          {status}
        </Tag>
      ),
      filters: Object.keys(statusColors).map((s) => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record) => {
        const items = [];
        if (hasPermission('bom', 'view')) items.push({ key: 'view', icon: <EyeOutlined />, label: 'View BOM' });
        if (hasPermission('bom', 'update')) items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit' });
        if (hasPermission('bom', 'add')) items.push({ key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate' });
        if (items.length > 0 && hasPermission('bom', 'delete')) items.push({ type: 'divider' });
        if (hasPermission('bom', 'delete')) items.push({ key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true });
        if (items.length === 0) return null;
        return (
          <Dropdown
            menu={{ items, onClick: ({ key }) => handleAction(key, record) }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  const handleAction = (key, record) => {
    switch (key) {
      case 'view':
        message.info(`Viewing BOM: ${record.bomId}`);
        break;
      case 'edit':
        navigate(`/bom/edit/${record.key}`);
        break;
      case 'duplicate':
        message.success(`BOM ${record.bomId} duplicated`);
        break;
      case 'delete':
        Modal.confirm({
          title: 'Delete BOM',
          content: `Are you sure you want to delete ${record.bomId}?`,
          okText: 'Delete',
          okType: 'danger',
          onOk: () => message.success('BOM deleted successfully'),
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Bill of Materials</h1>
        <div className="header-actions">
          {hasPermission('bom', 'view') && (
            <Button icon={<ExportOutlined />}>Export</Button>
          )}
          <PermissionGuard module="bom" operation="add">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/bom/new')}
            >
              Create BOM
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <Card>
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder="Search BOM..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Category"
            style={{ width: 150 }}
            allowClear
            options={[
              { label: 'Shirts', value: 'Shirts' },
              { label: 'Dresses', value: 'Dresses' },
              { label: 'Kids Wear', value: 'Kids Wear' },
              { label: 'Denim', value: 'Denim' },
            ]}
          />
          <Select
            placeholder="Status"
            style={{ width: 150 }}
            allowClear
            options={Object.keys(statusColors).map((s) => ({ label: s, value: s }))}
          />
          <Button icon={<FilterOutlined />}>More Filters</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={boms}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            total: boms.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} BOMs`,
          }}
          rowSelection={{
            type: 'checkbox',
          }}
        />
      </Card>
    </div>
  );
};

export default BOMList;
