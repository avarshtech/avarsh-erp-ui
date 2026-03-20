import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Tag,
  Select,
  Typography,
  message,
  Row,
  Col,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchBoms, deleteBom } from '../../services/bomService';
import { BOM_STATUS, getStatusLabel, EDITABLE_STATUSES } from '../../utils/bomConstants';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import BOMView from './BOMView';

const { Text } = Typography;

const STATUS_COLORS = {
  DRAFT: 'default',
  CREATED: 'green',
};

const BOMList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  // Permissions
  const canView = hasPermission('bom', 'view');
  const canAdd = hasPermission('bom', 'add');
  const canUpdate = hasPermission('bom', 'update');
  const canDelete = hasPermission('bom', 'delete');

  const fetchData = useCallback(async (page, size, sort, direction) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1,
        size: size || pagination.pageSize,
        sort: sort || sortField,
        direction: direction || sortDirection,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;

      const res = await searchBoms(params);
      setData(res.content || []);
      setPagination((prev) => ({
        ...prev,
        current: (res.page ?? 0) + 1,
        pageSize: res.size || prev.pageSize,
        total: res.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load BOMs');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pagination.current, pagination.pageSize, sortField, sortDirection]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Table change (pagination, sorting)
  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  // Delete
  const handleDelete = async (record) => {
    setDeletingId(record.id);
    try {
      await deleteBom(record.id);
      message.success(`${record.orderNo} deleted successfully`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete BOM');
    } finally {
      setDeletingId(null);
    }
  };

  // View
  const handleView = (record) => {
    setViewingBom(record);
    setViewModalVisible(true);
  };

  // Can edit?
  const canEditBom = (record) =>
    EDITABLE_STATUSES.includes(record.status) && canUpdate;

  // Can delete? (only DRAFT)
  const canDeleteBom = (record) =>
    record.status === BOM_STATUS.DRAFT && canDelete;

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      fixed: 'left',
      width: 160,
      sorter: true,
      render: (text, record) => (
        <Text
          strong
          style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => handleView(record)}
        >
          {text}
        </Text>
      ),
    },
    {
      title: 'Style No',
      dataIndex: 'styleName',
      key: 'styleName',
      width: 140,
      sorter: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Season',
      dataIndex: 'season',
      key: 'season',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Lines',
      dataIndex: 'lineCount',
      key: 'lineCount',
      width: 70,
      align: 'center',
      render: (count) => <Tag>{count || 0}</Tag>,
    },
    {
      title: 'Purchase Qty',
      dataIndex: 'totalPurchaseQty',
      key: 'totalPurchaseQty',
      width: 130,
      align: 'right',
      sorter: true,
      render: (qty) => qty ? <Text strong>{Number(qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag
          color={STATUS_COLORS[status] || 'default'}
          style={{ borderRadius: 20 }}
        >
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
          )}
          {canEditBom(record) && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/bom/edit/${record.id}`, { state: { bomData: record } })}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
          {canDeleteBom(record) && (
            <Popconfirm
              title="Delete BOM"
              description={`Are you sure you want to delete "${record.orderNo}"?`}
              onConfirm={() => handleDelete(record)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true, loading: deletingId === record.id }}
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Bill of Materials</h1>
        <div className="header-actions">
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
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input
              placeholder="Search order no, style, buyer..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={4} lg={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.keys(STATUS_COLORS).map((s) => ({
                label: getStatusLabel(s),
                value: s,
              }))}
            />
          </Col>
          <Col>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchData(pagination.current, pagination.pageSize)}
              />
            </Tooltip>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1000 }}
          onChange={handleTableChange}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} BOMs`,
          }}
        />
      </Card>

      {/* ── BOM View Modal ── */}
      <BOMView
        open={viewModalVisible}
        bomData={viewingBom}
        onClose={() => {
          setViewModalVisible(false);
          setViewingBom(null);
        }}
        onStatusChange={() => {
          setViewModalVisible(false);
          setViewingBom(null);
          fetchData(pagination.current, pagination.pageSize);
        }}
      />
    </div>
  );
};

export default BOMList;
