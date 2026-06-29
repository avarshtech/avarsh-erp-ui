import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Drawer, Empty, Select, Space, Table, Tag, Typography,
} from 'antd';
import { EyeOutlined, ReloadOutlined, AuditOutlined } from '@ant-design/icons';
import { getPendingApprovals, getApprovalHistory } from '../../services/core/approvalFlowService';
import {
  ENTITY_TYPES, ENTITY_TYPE_COLORS, entityActionUrl,
} from '../../utils/approvalFlowConstants';
import ApprovalActionBar from '../../components/approval/ApprovalActionBar';
import ApprovalHistoryTimeline from '../../components/approval/ApprovalHistoryTimeline';

const { Title, Text } = Typography;

const entityLabel = (value) =>
  ENTITY_TYPES.find((t) => t.value === value)?.label || value;

/**
 * "My Approvals" inbox — all pending approval requests across modules
 * that the current user can act on (server-filtered by user/role level match).
 */
const MyApprovals = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [typeFilter, setTypeFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getPendingApprovals() || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDrawer = useCallback(async (record) => {
    setSelected(record);
    try {
      setSelectedHistory(await getApprovalHistory(record.entityType, record.entityId) || []);
    } catch {
      setSelectedHistory([]);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setSelected(null);
    setSelectedHistory([]);
  }, []);

  const dataSource = useMemo(
    () => (typeFilter ? requests.filter((r) => r.entityType === typeFilter) : requests),
    [requests, typeFilter],
  );

  const presentTypes = useMemo(
    () => [...new Set(requests.map((r) => r.entityType))],
    [requests],
  );

  const columns = useMemo(() => [
    {
      title: 'Reference',
      dataIndex: 'entityReference',
      key: 'entityReference',
      render: (text) => <Text strong style={{ fontFamily: 'monospace' }}>{text || '—'}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type) => <Tag color={ENTITY_TYPE_COLORS[type] || 'default'}>{entityLabel(type)}</Tag>,
    },
    {
      title: 'Submitted By',
      dataIndex: 'submittedByName',
      key: 'submittedByName',
      render: (name) => name || '—',
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (ts) => (ts ? new Date(ts).toLocaleString() : '—'),
    },
    {
      title: 'Waiting At',
      key: 'level',
      render: (_, r) => (
        <Tag color="processing">
          Level {r.currentLevel}/{r.totalLevels}{r.currentLevelName ? ` — ${r.currentLevelName}` : ''}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="primary" icon={<AuditOutlined />} onClick={() => openDrawer(r)}>
            Review
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(entityActionUrl(r.entityType, r.entityId))}
          >
            Open
          </Button>
        </Space>
      ),
    },
  ], [navigate, openDrawer]);

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>My Approvals</Title>
        <Space>
          <Select
            allowClear
            placeholder="Filter by type"
            style={{ width: 200 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={presentTypes.map((t) => ({ value: t, label: entityLabel(t) }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No approvals waiting on you"
              />
            ),
          }}
        />
      </Card>

      <Drawer
        title={selected ? `${entityLabel(selected.entityType)} · ${selected.entityReference || ''}` : ''}
        open={!!selected}
        onClose={closeDrawer}
        width={480}
      >
        {selected && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <ApprovalActionBar
              entityType={selected.entityType}
              entityId={selected.entityId}
              docLabel={entityLabel(selected.entityType)}
              docNumber={selected.entityReference}
              onActionComplete={() => { closeDrawer(); load(); }}
            />
            <div>
              <Text strong>History</Text>
              <ApprovalHistoryTimeline requests={selectedHistory} />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default MyApprovals;
