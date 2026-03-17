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
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  searchCostSheets,
  deleteCostSheet,
  duplicateCostSheet,
} from '../../services/costingService';
import { hasPermission } from '../../utils/permissions';
import {
  COSTING_STATUS,
  STATUS_COLORS,
  getStatusLabel,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  SEASONS,
  formatCurrency,
} from '../../utils/costingConstants';
import { getBuyers } from '../../services/buyerService';
import CostingHistoryModal from './CostingHistoryModal';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_CONFIG = {
  [COSTING_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [COSTING_STATUS.FINAL]: { color: 'blue', icon: <SendOutlined /> },
  [COSTING_STATUS.APPROVED]: { color: 'green', icon: <CheckCircleOutlined /> },
};

const CostingList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 25,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [buyerFilter, setBuyerFilter] = useState(undefined);
  const [seasonFilter, setSeasonFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState(null);
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Permissions
  const canAdd = hasPermission('costing', 'add');
  const canView = hasPermission('costing', 'view');
  const canUpdate = hasPermission('costing', 'update');
  const canDelete = hasPermission('costing', 'delete');

  const fetchData = useCallback(
    async (page, pageSize, sort, direction) => {
      setLoading(true);
      try {
        const params = {
          page: (page || pagination.current) - 1,
          size: pageSize || pagination.pageSize,
          sort: sort || sortField,
          direction: direction || sortDirection,
        };

        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter;
        if (buyerFilter) params.buyerId = buyerFilter;
        if (seasonFilter) params.season = seasonFilter;
        if (dateRange && dateRange.length === 2) {
          params.dateFrom = dateRange[0].format('YYYY-MM-DD');
          params.dateTo = dateRange[1].format('YYYY-MM-DD');
        }

        const response = await searchCostSheets(params);
        setData(response.content || []);
        setPagination((prev) => ({
          ...prev,
          current: page || prev.current,
          pageSize: pageSize || prev.pageSize,
          total: response.totalElements || 0,
        }));
      } catch {
        message.error('Failed to load cost sheets');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, buyerFilter, seasonFilter, dateRange]
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch buyer options on mount
  useEffect(() => {
    getBuyers()
      .then((buyers) =>
        setBuyerOptions((buyers || []).map((b) => ({ value: b.id, label: b.name })))
      )
      .catch(() => {});
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, buyerFilter, seasonFilter, dateRange]);

  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  const handleDelete = async (record) => {
    setDeletingId(record.id);
    try {
      await deleteCostSheet(record.id);
      message.success(`${record.costingId} deleted successfully`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete cost sheet');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (record) => {
    setDuplicatingId(record.id);
    try {
      const dup = await duplicateCostSheet(record.id);
      message.success(`Duplicated as ${dup.costingId}`);
      fetchData(1, pagination.pageSize);
    } catch {
      message.error('Failed to duplicate cost sheet');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleClearFilters = () => {
    setSearchText('');
    setDebouncedSearch('');
    setStatusFilter(undefined);
    setBuyerFilter(undefined);
    setSeasonFilter(undefined);
    setDateRange(null);
  };

  const handleViewHistory = (record) => {
    setHistoryRecord(record);
    setHistoryModalOpen(true);
  };

  const canEditSheet = (record) =>
    EDITABLE_STATUSES.includes(record.status) && canUpdate;

  const canDeleteSheet = (record) =>
    DELETABLE_STATUSES.includes(record.status) && canDelete;

  const columns = [
    {
      title: 'Costing ID',
      dataIndex: 'costingId',
      key: 'costingId',
      fixed: 'left',
      width: 160,
      sorter: true,
      render: (text, record) => (
        <Text
          strong
          style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate(`/costing/${record.id}`)}
        >
          {text}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 180,
      ellipsis: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Style #',
      dataIndex: 'styleNo',
      key: 'styleNo',
      width: 140,
      render: (text) => text || '-',
    },
    {
      title: 'Garment Name',
      dataIndex: 'garmentName',
      key: 'garmentName',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Season',
      dataIndex: 'season',
      key: 'season',
      width: 90,
      render: (val) => val || '-',
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 140,
      align: 'right',
      sorter: true,
      render: (amount, record) => (
        <Text strong style={{ color: 'var(--success-color)' }}>
          {formatCurrency(amount, record.currency)}
        </Text>
      ),
    },
    {
      title: 'Final Price',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      width: 140,
      align: 'right',
      render: (amount, record) => {
        const hasSizes = record.sizeSummaries && record.sizeSummaries.length > 0;
        const content = (
          <div>
            <Text strong style={{ color: 'var(--primary-color)' }}>
              {formatCurrency(amount, record.quoteCurrency)}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatCurrency(record.finalPriceUsd || amount, 'USD')}
              </Text>
            </div>
          </div>
        );
        if (!hasSizes) return content;
        return (
          <Tooltip
            title={
              <div>
                {record.sizeSummaries.map((ss) => (
                  <div key={ss.sizes}>{ss.sizes}: $ {ss.finalPriceUsd?.toFixed(2)}</div>
                ))}
              </div>
            }
          >
            {content}
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const config = STATUS_CONFIG[status] || {};
        return (
          <Tag
            color={config.color || 'default'}
            icon={config.icon}
            style={{ borderRadius: 20 }}
          >
            {getStatusLabel(status)}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/costing/${record.id}`)}
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
          )}
          {canEditSheet(record) && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/costing/edit/${record.id}`)}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
          <Tooltip title="Duplicate">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record)}
              loading={duplicatingId === record.id}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          {(record.status === COSTING_STATUS.APPROVED || record.status === COSTING_STATUS.FINAL) && (
            <Tooltip title="History">
              <Button
                type="text"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => handleViewHistory(record)}
                style={{ color: '#faad14' }}
              />
            </Tooltip>
          )}
          {canDeleteSheet(record) && (
            <Popconfirm
              title="Delete Cost Sheet"
              description={`Are you sure you want to delete "${record.costingId}"?`}
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
        <h1>Costing Module</h1>
        <div className="header-actions">
          {canAdd && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/costing/new')}
            >
              New Cost Sheet
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input
              placeholder="Search ID, buyer, style..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={4} lg={3}>
            <Select
              placeholder="Buyer"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              value={buyerFilter}
              onChange={setBuyerFilter}
              options={buyerOptions}
            />
          </Col>
          <Col xs={12} sm={8} md={3} lg={3}>
            <Select
              placeholder="Season"
              style={{ width: '100%' }}
              allowClear
              value={seasonFilter}
              onChange={setSeasonFilter}
              options={SEASONS}
            />
          </Col>
          <Col xs={24} sm={12} md={5} lg={4}>
            <RangePicker
              placeholder={['Date From', 'Date To']}
              value={dateRange}
              onChange={setDateRange}
              format="DD-MMM-YYYY"
              style={{ width: '100%', height: '40px' }}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={3} lg={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.values(COSTING_STATUS).map((s) => ({
                label: getStatusLabel(s),
                value: s,
              }))}
            />
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Button type="link" onClick={handleClearFilters}>
                Clear
              </Button>
              <Tooltip title="Refresh">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchData(pagination.current, pagination.pageSize)}
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1400 }}
          onChange={handleTableChange}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} cost sheets`,
          }}
        />
      </Card>

      <CostingHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        costingId={historyRecord?.costingId}
        recordId={historyRecord?.id}
      />
    </div>
  );
};

export default CostingList;
