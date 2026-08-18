import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Space,
  Tag,
  Switch,
  Badge,
  Select,
  Input,
  Popover,
  Tooltip,
  App,
} from 'antd';
import {
  PlusOutlined,
  ApartmentOutlined,
  CopyOutlined,
  LockOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import {
  getApprovalFlows,
  deleteApprovalFlow,
  toggleFlowActive,
  cloneApprovalFlow,
} from '../../services/core/approvalFlowService';
import { ENTITY_TYPES, ENTITY_TYPE_COLORS } from '../../utils/approvalFlowConstants';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import ApprovalFlowForm from './ApprovalFlowForm';

const ApprovalFlowList = () => {
  const { message } = App.useApp();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState(new Set());

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApprovalFlows();
      setFlows(data);
    } catch (err) {
      message.error('Failed to load approval flows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleAdd = useCallback(() => {
    setEditingFlow(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingFlow(record);
    setDrawerOpen(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteApprovalFlow(id);
      message.success('Approval flow deleted');
      fetchFlows();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete flow');
    }
  }, [fetchFlows]);

  const handleToggleActive = useCallback(async (id) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      await toggleFlowActive(id);
      fetchFlows();
    } catch (err) {
      message.error('Failed to toggle flow status');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [fetchFlows]);

  // Clone & Edit — the supported way to "change levels" of a flow that has history
  const handleClone = useCallback(async (record) => {
    try {
      const clone = await cloneApprovalFlow(record.id);
      message.success(`Cloned as "${clone.name}" (inactive). Edit it, then activate.`);
      await fetchFlows();
      setEditingFlow(clone);
      setDrawerOpen(true);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to clone flow');
    }
  }, [fetchFlows]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setEditingFlow(null);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    handleDrawerClose();
    fetchFlows();
  }, [handleDrawerClose, fetchFlows]);

  const filteredFlows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return flows.filter(f =>
      (!entityTypeFilter || f.entityType === entityTypeFilter) &&
      (!term || f.name?.toLowerCase().includes(term) || f.description?.toLowerCase().includes(term)));
  }, [flows, entityTypeFilter, search]);

  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text, record) => (
        <Space>
          <ApartmentOutlined style={{ color: '#6366f1' }} />
          <a onClick={() => handleEdit(record)}>{text}</a>
          {record.hasHistory && (
            <Tooltip title="Levels locked — documents were already routed through this flow. Clone to restructure.">
              <LockOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 160,
      render: (type) => {
        const config = ENTITY_TYPES.find(e => e.value === type);
        return <Tag color={ENTITY_TYPE_COLORS[type]}>{config?.label || type}</Tag>;
      },
    },
    {
      title: 'Levels',
      dataIndex: 'levelsCount',
      key: 'levelsCount',
      width: 90,
      align: 'center',
      render: (count, record) => (
        <Popover
          title="Approval chain"
          content={
            <Space wrap size={6}>
              {(record.levels || []).map((level, index) => (
                <Space key={level.levelNumber} size={6}>
                  {index > 0 && <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 10 }} />}
                  <Tag style={{ marginInlineEnd: 0 }}>
                    {level.levelNumber}. {level.levelName || level.approverRoleName || level.approverUserName || `Level ${level.levelNumber}`}
                  </Tag>
                </Space>
              ))}
            </Space>
          }
        >
          <Badge count={count} showZero color="#6366f1" style={{ cursor: 'pointer' }} />
        </Popover>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingRequestsCount',
      key: 'pendingRequestsCount',
      width: 90,
      align: 'center',
      render: (count) => count > 0
        ? <Badge count={count} color="orange" />
        : <span style={{ color: '#999' }}>0</span>,
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      width: 80,
      align: 'center',
      render: (active, record) => (
        <PermissionGuard module="approval-flows" operation="update">
          <Switch
            checked={active}
            size="small"
            loading={togglingIds.has(record.id)}
            onChange={() => handleToggleActive(record.id)}
          />
        </PermissionGuard>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => formatDate(date),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard module="approval-flows" operation="update">
            <Tooltip title={record.hasHistory ? 'Edit (levels locked — clone to restructure)' : undefined}>
              <ActionButton type="edit" onClick={() => handleEdit(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard module="approval-flows" operation="add">
            <Tooltip title="Clone as a new inactive flow (use this to change levels of a flow with history)">
              <ActionButton icon={<CopyOutlined />} onClick={() => handleClone(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard module="approval-flows" operation="delete">
            <DeleteConfirm
              title="Delete Approval Flow"
              description={record.hasHistory || record.pendingRequestsCount > 0
                ? 'This flow has approval requests and cannot be deleted. Deactivate it instead.'
                : `Are you sure you want to delete "${record.name}"?`}
              onConfirm={() => handleDelete(record.id)}
              disabled={record.hasHistory || record.pendingRequestsCount > 0}
            />
          </PermissionGuard>
        </Space>
      ),
    },
  ], [handleEdit, handleDelete, handleToggleActive, handleClone, togglingIds]);

  return (
    <>
      <PageHeader
        title="Approval Flows"
        subtitle="Configure approval workflows for different entity types"
      />
      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Input.Search
              placeholder="Search flows"
              allowClear
              style={{ width: 220 }}
              onSearch={setSearch}
              onChange={(e) => !e.target.value && setSearch('')}
            />
            <Select
              placeholder="Filter by Entity Type"
              allowClear
              style={{ width: 200 }}
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
              options={ENTITY_TYPES}
            />
          </Space>
          <PermissionGuard module="approval-flows" operation="add">
            <ActionButton
              type="add"
              label="New Flow"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            />
          </PermissionGuard>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredFlows}
          loading={loading}
          pagination={getTablePagination(filteredFlows.length)}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <EmptyState
                description="No approval flows configured"
                hint="Create a new approval flow to get started"
              />
            ),
          }}
        />
      </Card>

      <ApprovalFlowForm
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSuccess={handleSaveSuccess}
        editingFlow={editingFlow}
        onSwitchFlow={(clone) => { fetchFlows(); setEditingFlow(clone); }}
      />
    </>
  );
};

export default ApprovalFlowList;
