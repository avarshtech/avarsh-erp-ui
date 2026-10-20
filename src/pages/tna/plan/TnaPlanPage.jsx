import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Segmented, Select, Skeleton, Space,
} from 'antd';
import {
  TableOutlined, BarChartOutlined, AppstoreOutlined, HistoryOutlined, FlagOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { getPlan, getSettings } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { ACTIVITY_STATUS, DELAY_BASIS, fmtDate } from '../../../utils/tnaConstants';
import MockDataNote from '../components/MockDataNote';
import TnaGantt from '../components/TnaGantt';
import AcknowledgeInfeasibleModal from '../components/AcknowledgeInfeasibleModal';
import PlanHeaderStrip from './PlanHeaderStrip';
import PlanBanners from './PlanBanners';
import PlanGrid from './PlanGrid';
import PlanSwimlane from './PlanSwimlane';
import ActivityDetailDrawer from './ActivityDetailDrawer';
import ReportIssueModal from './ReportIssueModal';
import BlockedPlanNotice from './BlockedPlanNotice';

const VIEWS = [
  { value: 'grid', label: 'Grid', icon: <TableOutlined /> },
  { value: 'timeline', label: 'Timeline', icon: <BarChartOutlined /> },
  { value: 'swimlane', label: 'Swimlane', icon: <AppstoreOutlined /> },
];

/** WF-02/03/04 — one order's derived plan in three views over the same data; nothing is typed. */
const TnaPlanPage = () => {
  const { planId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [plan, setPlan] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ module: null, status: null, floatBasis: 'latest' });
  const [issueFor, setIssueFor] = useState(null);
  const [ackOpen, setAckOpen] = useState(false);
  const view = params.get('view') || 'grid';
  const activityCode = params.get('activity');

  const load = useCallback(() => {
    Promise.all([getPlan(planId), getSettings()])
      .then(([p, s]) => { setPlan(p); setSettings(s); })
      .catch((e) => message.error(e.message || 'Failed to load the plan'))
      .finally(() => setLoading(false));
  }, [planId, message]);
  useEffect(load, [load]);

  const setParam = useCallback((key, value) => setParams((p) => {
    const next = new URLSearchParams(p);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }), [setParams]);
  const openActivity = useCallback((code) => setParam('activity', code), [setParam]);

  const activities = useMemo(() => (plan?.activities || []).filter((a) => (
    (!filters.module || a.sourceModule === filters.module) && (!filters.status || a.status === filters.status)
  )), [plan, filters]);

  if (loading) return <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>;
  if (!plan) return <EmptyState title="Plan not found" description="This order has no Time & Action plan, or the link is stale" />;
  const h = plan.header;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`T&A plan — ${h.orderNo}`}
        subtitle={`${h.buyer} · ${h.styleNo} · ${h.garmentType} · order ${fmtDate(h.orderDate)} · ${h.qty.toLocaleString('en-IN')} pcs`}
        backPath="/tna/control-tower"
        extra={(
          <Space wrap>
            <MockDataNote asOf={h.asOf} />
            <Button icon={<HistoryOutlined />} onClick={() => navigate(`/tna/revisions?plan=${h.id}`)}>Revisions & audit</Button>
            {plan.activities.length > 0 && <Button icon={<FlagOutlined />} onClick={() => setIssueFor('')}>Report data issue</Button>}
          </Space>
        )}
      />
      {h.status === 'BLOCKED' ? <BlockedPlanNotice plan={plan} /> : (
        <>
          <PlanHeaderStrip header={h} />
          <PlanBanners header={h} activities={plan.activities} settings={settings} canAcknowledge={hasPermission('tna', 'update')} onAcknowledge={() => setAckOpen(true)} />
          <Card size="small" styles={{ body: { paddingTop: 12 } }}>
            <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
              <Segmented value={view} onChange={(v) => setParam('view', v === 'grid' ? null : v)} options={VIEWS} />
              {view === 'grid' && (
                <Space wrap>
                  <Select allowClear name="module" placeholder="Module: all" style={{ width: 170 }} value={filters.module} onChange={(v) => setFilters((f) => ({ ...f, module: v }))} options={[...new Set(plan.activities.map((a) => a.sourceModule))].map((m) => ({ value: m, label: m }))} />
                  <Select allowClear name="status" placeholder="Status: all" style={{ width: 170 }} value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={Object.entries(ACTIVITY_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
                  <Segmented size="small" value={filters.floatBasis} onChange={(v) => setFilters((f) => ({ ...f, floatBasis: v }))} options={DELAY_BASIS.map((b) => ({ value: b.value, label: `Float vs ${b.value}` }))} />
                </Space>
              )}
            </Space>
            {view === 'grid' && <PlanGrid activities={activities} floatBasis={filters.floatBasis} onOpen={openActivity} />}
            {view === 'timeline' && <TnaGantt header={h} activities={plan.activities} onOpen={openActivity} />}
            {view === 'swimlane' && <PlanSwimlane activities={plan.activities} driving={h.driving} onOpen={openActivity} />}
            <Alert
              type="info"
              style={{ marginTop: 12 }}
              title={`All ${plan.activities.length} activities were derived from this order's Order Entry, BOM, Sample Request, Cut Panel and Garment Process records — their steps, sequence, colourways and quantities as recorded. Nothing on this screen is typed.`}
            />
          </Card>
        </>
      )}
      <ActivityDetailDrawer planId={h.id} code={activityCode} onClose={() => setParam('activity', null)} onReportIssue={(code) => setIssueFor(code)} />
      <ReportIssueModal open={issueFor !== null} planId={h.id} activities={plan.activities} activityCode={issueFor || undefined} onClose={() => setIssueFor(null)} />
      <AcknowledgeInfeasibleModal open={ackOpen} planId={h.id} orderNo={h.orderNo} onClose={() => setAckOpen(false)} onDone={() => { setAckOpen(false); load(); }} />
    </div>
  );
};

export default TnaPlanPage;
