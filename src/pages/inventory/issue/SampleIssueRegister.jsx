import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Alert, Badge, Button, Card, Col, DatePicker, Input, Row, Segmented, Skeleton, Space, Table,
  Tabs, Typography,
} from 'antd';
import { SearchOutlined, FileDoneOutlined, ClockCircleOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listSampleIssues, cancelSampleIssue } from '../../../services/sr/srService';
import { SAMPLE_TYPE_LIST } from '../../../utils/sampleRequestConstants';
import { hasPermission } from '../../../utils/permissions';
import { errorText, toastUnlessHandled } from '../../../utils/apiError';
import { getTablePagination } from '../../../utils/paginationConfig';
import { generateFabricIssueSlipPdf, generateAccessoriesIssueSlipPdf } from '../../../utils/issueSlipPdfGenerator';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import IssueViewDrawer from './IssueViewDrawer';
import CancelIssueModal from './CancelIssueModal';
import AwaitingSrsAlert from './AwaitingSrsAlert';
import { fabricIssueColumns, trimsIssueColumns, SAMPLE_ISSUE_SCROLL_X } from './sampleIssueColumns';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ALL = 'ALL';
const OTHERS_TYPE_ID = SAMPLE_TYPE_LIST[SAMPLE_TYPE_LIST.length - 1].id;

// Sample volumes are small (a handful of documents per style), so one window
// covers the register and lets both toggle badges and every tab badge be
// counted off the same fetch. Search and dates narrow it server-side first.
const WINDOW_SIZE = 200;

const SIDE = {
  FABRIC: {
    label: 'Fabric Issues',
    newText: 'New Fabric Issue',
    path: '/inventory/issue/sample/fabric/new',
    columns: fabricIssueColumns,
    print: generateFabricIssueSlipPdf,
    empty: 'fabric',
  },
  ACCESSORY: {
    label: 'Trims Issues',
    newText: 'New Trims Issue',
    path: '/inventory/issue/sample/trims/new',
    columns: trimsIssueColumns,
    print: generateAccessoriesIssueSlipPdf,
    empty: 'trims',
  },
};

/**
 * The Sample Request Issue register.
 *
 * Fabric and trims are separate documents against one sample request, so the
 * register is two registers: the eight fixed sample-type tabs stay, and inside
 * every tab a toggle switches which document type is listed. The toggle choice
 * is owned by the Material Issue page, so it survives the round-trip to a form
 * and the page header's button follows it.
 */
const SampleIssueRegister = ({ issueType = 'FABRIC', onIssueTypeChange }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [stats, setStats] = useState(null);
  const [awaitingSrs, setAwaitingSrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [activeKey, setActiveKey] = useState(ALL);
  const [reloadToken, setReloadToken] = useState(0);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });
  const [cancelModal, setCancelModal] = useState({ open: false, record: null });

  const canAdd = hasPermission('inventory-issue', 'add');
  const canCancel = hasPermission('inventory-issue', 'update');
  const side = SIDE[issueType] || SIDE.FABRIC;

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // The fetch lives in the effect so a fast typist's earlier response cannot
  // land after a later one and repaint the register with stale rows.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await listSampleIssues({
          search: searchText.trim() || undefined,
          dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'),
          dateTo: dateRange?.[1]?.format('YYYY-MM-DD'),
          size: WINDOW_SIZE,
        });
        if (cancelled) return;
        setRows(res.content || []);
        setTotalElements(res.totalElements ?? (res.content || []).length);
        setStats(res.stats || null);
        setAwaitingSrs(res.awaitingSrs || []);
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        // Without this the StatCards (loading={!stats}) would shimmer forever
        setLoadError(errorText(e, 'Failed to load sample request issues'));
        setStats({ totalIssues: 0, awaitingIssue: 0, inProduction: 0 });
        toastUnlessHandled(message, e, 'Failed to load sample request issues');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchText, dateRange, reloadToken, message]);

  // One fetch carries both document types, so the toggle badges and the tab
  // badges are always counted off the same rows the tables show.
  const bySide = useMemo(() => ({
    FABRIC: rows.filter((r) => r.issueType === 'FABRIC'),
    ACCESSORY: rows.filter((r) => r.issueType !== 'FABRIC'),
  }), [rows]);

  const sideRows = bySide[issueType] || bySide.FABRIC;

  const byType = useMemo(() => {
    const map = new Map(SAMPLE_TYPE_LIST.map((t) => [t.id, []]));
    sideRows.forEach((r) => {
      // A type id the fixed list does not know still lands somewhere sensible
      (map.get(r.sampleTypeId) || map.get(OTHERS_TYPE_ID)).push(r);
    });
    return map;
  }, [sideRows]);

  /** The matching form, carrying the tab's sample type and optionally an SR. */
  const formPath = useCallback((srId) => {
    const qs = new URLSearchParams();
    if (activeKey !== ALL) qs.set('sampleTypeId', activeKey);
    if (srId != null) qs.set('srId', String(srId));
    const q = qs.toString();
    return q ? `${side.path}?${q}` : side.path;
  }, [side, activeKey]);

  const openSr = useCallback(
    (r) => navigate(`/sample-requests/list?viewId=${r.sampleRequestId}`),
    [navigate],
  );

  const columns = useMemo(() => side.columns({
    showType: activeKey === ALL,
    onView: (record) => setViewDrawer({ open: true, record }),
    onPrint: (record) => side.print(record),
    onCancel: (record) => setCancelModal({ open: true, record }),
    onOpenSr: openSr,
    canCancel,
  }), [side, activeKey, canCancel, openSr]);

  const renderTable = useCallback((data, typeName) => (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{
        x: (SAMPLE_ISSUE_SCROLL_X[issueType] || SAMPLE_ISSUE_SCROLL_X.FABRIC)[
          activeKey === ALL ? 'withType' : 'withoutType'],
      }}
      pagination={getTablePagination({ pageSize: 10 }, `sample ${side.empty} issues`)}
      locale={{
        emptyText: (
          <EmptyState
            title={`No ${typeName ? `${typeName} ` : ''}sample ${side.empty} issues yet`}
            description={issueType === 'FABRIC'
              ? 'Picking rolls against a sample request records the issue here and starts its production.'
              : 'Issuing trims against a sample request records the issue here and starts its production.'}
          />
        ),
      }}
    />
  ), [columns, loading, issueType, activeKey, side]);

  // Rendered inside each tab (Tabs mount only the active one), so the choice
  // reads as a property of the tab you are on rather than of the page.
  const toggle = useMemo(() => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <Segmented
        value={issueType}
        onChange={onIssueTypeChange}
        options={Object.entries(SIDE).map(([value, cfg]) => ({
          value,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              {cfg.label}
              <Badge count={bySide[value].length} size="small" showZero color={bySide[value].length > 0 ? 'blue' : undefined} />
            </span>
          ),
        }))}
      />
      {canAdd && (
        <ActionButton action="create" text={side.newText} onClick={() => navigate(formPath(null))} />
      )}
    </div>
  ), [issueType, onIssueTypeChange, bySide, canAdd, side, navigate, formPath]);

  const tabItems = useMemo(() => {
    const label = (text, count) => (
      <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {text}
        <Badge count={count} size="small" showZero color={count > 0 ? 'purple' : undefined} />
      </span>
    );
    const body = (data, typeName) => <>{toggle}{renderTable(data, typeName)}</>;
    return [
      { key: ALL, label: label('All Types', sideRows.length), children: body(sideRows, null) },
      ...SAMPLE_TYPE_LIST.map((t) => {
        const data = byType.get(t.id) || [];
        return { key: String(t.id), label: label(t.name, data.length), children: body(data, t.name) };
      }),
    ];
  }, [sideRows, byType, renderTable, toggle]);

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
          action={<Button size="small" onClick={reload}>Retry</Button>}
        />
      )}

      <AwaitingSrsAlert
        awaitingSrs={awaitingSrs}
        canAdd={canAdd}
        onIssue={(srId) => navigate(formPath(srId))}
      />

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Issue #, SR No or style..."
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <RangePicker style={{ width: 280 }} placeholder={['Issued From', 'Issued To']} value={dateRange} onChange={setDateRange} />
        </Space>
        {totalElements > rows.length && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {`Showing the ${rows.length} most recent of ${totalElements} documents — narrow the search or the date range to see older ones.`}
          </Text>
        )}
        <Tabs size="small" items={tabItems} activeKey={activeKey} onChange={setActiveKey} />
      </Card>

      <IssueViewDrawer
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
        // From the record, not the toggle — an open drawer must not change
        // shape because the register switched sides behind it.
        type={viewDrawer.record?.issueType === 'FABRIC' ? 'fabric' : 'accessories'}
      />
      {/* Sample issues cancel through their own endpoint: only that one holds
          the request row while the surviving documents are counted, which is
          what decides whether the sample drops back to Submitted. */}
      <CancelIssueModal
        open={cancelModal.open}
        record={cancelModal.record}
        onClose={() => setCancelModal({ open: false, record: null })}
        onCancelled={reload}
        cancelFn={cancelSampleIssue}
      />
    </div>
  );
};

export default SampleIssueRegister;
