import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Drawer, Empty, Input, Space, Table, Tag, Typography,
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

const AGING_WARN_HOURS = 48;

/** Compact "how long has this been waiting" label, e.g. "3h" / "2d 5h". */
const waitingFor = (submittedAt) => {
  if (!submittedAt) return null;
  const hours = Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 3600000));
  const label = hours < 1 ? '<1h' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return { hours, label };
};

/**
 * "My Approvals" inbox — all pending approval requests across modules
 * that the current user can act on (server-filtered by user/role level match).
 */
const MyApprovals = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [typeFilter, setTypeFilter] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);

  // Debounce free-text search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
    () => requests.filter((r) =>
      (!typeFilter || r.entityType === typeFilter) &&
      (!search
        || r.entityReference?.toLowerCase().includes(search)
        || r.approvalFlowName?.toLowerCase().includes(search)
        || r.submittedByName?.toLowerCase().includes(search))),
    [requests, typeFilter, search],
  );

  const presentTypes = useMemo(() => {
    const counts = new Map();
    requests.forEach((r) => counts.set(r.entityType, (counts.get(r.entityType) || 0) + 1));
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  }, [requests]);

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
      sorter: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      render: (ts) => (ts ? new Date(ts).toLocaleString() : '—'),
    },
    {
      title: 'Waiting',
      key: 'waiting',
      width: 100,
      sorter: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      render: (_, r) => {
        const aging = waitingFor(r.submittedAt);
        if (!aging) return '—';
        return (
          <Tag color={aging.hours >= AGING_WARN_HOURS ? 'warning' : 'default'}>
            {aging.label}
          </Tag>
        );
      },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>My Approvals</Title>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search reference, flow, submitter"
            style={{ width: 260 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </div>
      {presentTypes.length > 1 && (
        <Space wrap size={4} style={{ marginBottom: 12 }}>
          <Tag.CheckableTag checked={!typeFilter} onChange={() => setTypeFilter(null)}>
            All ({requests.length})
          </Tag.CheckableTag>
          {presentTypes.map(({ type, count }) => (
            <Tag.CheckableTag
              key={type}
              checked={typeFilter === type}
              onChange={(checked) => setTypeFilter(checked ? type : null)}
            >
              {entityLabel(type)} ({count})
            </Tag.CheckableTag>
          ))}
        </Space>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 900 }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
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
