import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Badge, Card, Col, DatePicker, Input, Row, Skeleton, Space, Table, Tabs, Tag, Typography, Alert, Button,
} from 'antd';
import { SearchOutlined, FileDoneOutlined, ClockCircleOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { listSampleIssues } from '../../../services/sr/srService';
import { SAMPLE_TYPE_LIST } from '../../../utils/sampleRequestConstants';
import { RAG_TAG_COLOR, deadlineLabel } from '../../../utils/deadlineUtils';
import { hasPermission } from '../../../utils/permissions';
import { getTablePagination } from '../../../utils/paginationConfig';
import StatCard from '../../../components/StatCard';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import SampleIssueViewDrawer from './SampleIssueViewDrawer';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ALL = 'ALL';

/**
 * Sample Request Issue segment (R2) — the issue REGISTER, laid out like the
 * Fabric / Accessories issue lists but split into the eight fixed sample-type
 * tabs. Each row is one SRI document covering a whole SR: fabric AND trims
 * together. Creating one is what moves its SR to In Production, so submitted
 * SRs still awaiting the store are surfaced above the table.
 * Mock-backed until the API phase (srService routes to the SR mock store).
 */
const SampleRequestIssuePane = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [awaitingSrs, setAwaitingSrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [activeKey, setActiveKey] = useState(ALL);
  const [viewId, setViewId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const canAdd = hasPermission('inventory-issue', 'add');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSampleIssues();
      setRows(res.content || []);
      setStats(res.stats || null);
      setAwaitingSrs(res.awaitingSrs || []);
      setLoadError(null);
    } catch (e) {
      // Without this the StatCards (loading={!stats}) would shimmer forever
      setLoadError(e.message || 'Failed to load sample request issues');
      setStats({ totalIssues: 0, awaitingIssue: 0, inProduction: 0 });
      message.error(e.message || 'Failed to load sample request issues');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  // Search + date narrow the whole register; the tabs then split what is left
  // by sample type, so a tab badge always matches the rows behind it.
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) => [r.issueNo, r.srNo, r.styleNo, r.garmentName, r.buyerName, r.orderNo]
        .some((v) => (v || '').toLowerCase().includes(q)));
    }
    if (dateRange?.[0] && dateRange?.[1]) {
      const from = dateRange[0].startOf('day');
      const to = dateRange[1].endOf('day');
      out = out.filter((r) => {
        const dt = dayjs(r.issuedDate);
        return !dt.isBefore(from) && !dt.isAfter(to);
      });
    }
    return out;
  }, [rows, searchText, dateRange]);

  const byType = useMemo(() => {
    const map = new Map(SAMPLE_TYPE_LIST.map((t) => [t.id, []]));
    filtered.forEach((r) => {
      const bucket = map.get(r.sampleTypeId) || map.get(SAMPLE_TYPE_LIST[SAMPLE_TYPE_LIST.length - 1].id);
      bucket.push(r);
    });
    return map;
  }, [filtered]);

  const columns = useMemo(() => {
    const showType = activeKey === ALL;
    return [
      {
        title: 'Issue #', dataIndex: 'issueNo', key: 'issueNo', width: 150, fixed: 'left',
        render: (v, r) => (
          <span style={{ whiteSpace: 'nowrap' }}>
            <RecordLink text={v} onClick={() => setViewId(r.id)} />
          </span>
        ),
      },
      {
        title: 'Issued On', dataIndex: 'issuedDate', key: 'issuedDate', width: 120, align: 'center',
        render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—'),
      },
      {
        title: 'Sample Request', dataIndex: 'srNo', key: 'srNo', width: 155,
        render: (v, r) => (
          <span style={{ whiteSpace: 'nowrap' }}>
            <RecordLink text={v} onClick={() => navigate(`/sample-requests/list?viewId=${r.srId}`)} />
          </span>
        ),
      },
      ...(showType ? [{
        title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 170,
        render: (v) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{v}</Tag>,
      }] : []),
      {
        title: 'Style / Garment', key: 'style', width: 230,
        render: (_, r) => (
          <>
            <Text strong>{r.styleNo}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{r.garmentName}</Text>
          </>
        ),
      },
      { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 140, ellipsis: true },
      {
        title: 'Materials Issued', key: 'materials', width: 200,
        // One document, both sections — that is the whole point of a sample issue
        render: (_, r) => (
          <Space size={4} style={{ whiteSpace: 'nowrap' }}>
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>{r.fabricCount} fabric</Tag>
            <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{r.trimCount} trims</Tag>
          </Space>
        ),
      },
      { title: 'Issued By', dataIndex: 'issuedBy', key: 'issuedBy', width: 130, ellipsis: true },
      {
        title: 'Actions', key: 'actions', width: 90, fixed: 'right', align: 'center',
        render: (_, r) => <ActionButton action="view" size="small" onClick={() => setViewId(r.id)} />,
      },
    ];
  }, [activeKey, navigate]);

  const renderTable = useCallback((data, typeName) => (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{ x: activeKey === ALL ? 1420 : 1250 }}
      pagination={getTablePagination({ pageSize: 10 }, 'sample issues')}
      locale={{
        emptyText: (
          <EmptyState
            title={typeName ? `No ${typeName} issues yet` : 'No sample issues yet'}
            description="Issuing material against a submitted sample request starts its production and records it here."
          />
        ),
      }}
    />
  ), [columns, loading, activeKey]);

  const tabItems = useMemo(() => {
    const label = (text, count) => (
      <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {text}
        <Badge count={count} size="small" showZero color={count > 0 ? 'purple' : undefined} />
      </span>
    );
    return [
      { key: ALL, label: label('All Types', filtered.length), children: renderTable(filtered, null) },
      ...SAMPLE_TYPE_LIST.map((t) => {
        const data = byType.get(t.id) || [];
        return { key: String(t.id), label: label(t.name, data.length), children: renderTable(data, t.name) };
      }),
    ];
  }, [filtered, byType, renderTable]);

  if (loading && rows.length === 0 && !stats) {
    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3].map((i) => (
            <Col xs={24} sm={8} key={i}><Card><Skeleton active title={{ width: '50%' }} paragraph={{ rows: 1 }} /></Card></Col>
          ))}
        </Row>
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Skeleton.Input active style={{ width: 250 }} />
            <Skeleton.Input active style={{ width: 280 }} />
          </Space>
          <Space style={{ marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton.Button key={i} active size="small" style={{ width: 90 }} />)}
          </Space>
          <Skeleton active title={false} paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <StatCard title="Sample Issues" value={stats?.totalIssues ?? 0} color="var(--primary-color)" icon={<FileDoneOutlined />} loading={!stats} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Awaiting Issue" value={stats?.awaitingIssue ?? 0} color="var(--warning-color)" icon={<ClockCircleOutlined />} loading={!stats} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="In Production" value={stats?.inProduction ?? 0} color="#8b5cf6" icon={<ToolOutlined />} loading={!stats} />
        </Col>
      </Row>

      {loadError && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="Could not load the sample issue register"
          description={loadError}
          action={<Button size="small" onClick={loadData}>Retry</Button>}
        />
      )}

      {awaitingSrs.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${awaitingSrs.length} submitted sample request${awaitingSrs.length > 1 ? 's are' : ' is'} awaiting material issue`}
          // Most urgent first, each one a direct link into its own issue form
          description={(
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {awaitingSrs.slice(0, 8).map((s) => (
                <Tag
                  key={s.id}
                  color={RAG_TAG_COLOR[s.inHandRag]}
                  style={{ cursor: canAdd ? 'pointer' : 'default', marginInlineEnd: 0, whiteSpace: 'nowrap' }}
                  onClick={() => canAdd && navigate(`/inventory/issue/sample/new?srId=${s.id}`)}
                >
                  {s.srNo} · {s.sampleTypeName} · in-hand {deadlineLabel(s.inHandDays)}
                  {s.priority === 'URGENT' ? ' · urgent' : ''}
                </Tag>
              ))}
              {awaitingSrs.length > 8 && (
                <Text type="secondary">{`+${awaitingSrs.length - 8} more`}</Text>
              )}
            </div>
          )}
          action={canAdd && (
            <Button size="small" type="primary" onClick={() => navigate('/inventory/issue/sample/new')}>
              Issue materials →
            </Button>
          )}
        />
      )}

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Issue #, SR No, style or buyer..."
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <RangePicker style={{ width: 280 }} placeholder={['Issued From', 'Issued To']} value={dateRange} onChange={setDateRange} />
        </Space>
        <Tabs size="small" items={tabItems} activeKey={activeKey} onChange={setActiveKey} />
      </Card>

      <SampleIssueViewDrawer
        open={viewId != null}
        issueId={viewId}
        onClose={() => setViewId(null)}
      />
    </div>
  );
};

export default SampleRequestIssuePane;
