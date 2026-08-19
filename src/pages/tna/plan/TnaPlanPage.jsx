import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Segmented, Skeleton } from 'antd';
import { TableOutlined, BarChartOutlined, AppstoreOutlined, HistoryOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { getPlan } from '../../../services/tna/tnaService';
import PlanHeaderStrip from './PlanHeaderStrip';
import PlanGrid from './PlanGrid';
import PlanSwimlane from './PlanSwimlane';
import TnaGantt from '../components/TnaGantt';
import ActualDrawer from './ActualDrawer';
import ReplanDrawer from './ReplanDrawer';
import AuditDrawer from './AuditDrawer';

/** §10 — the order TNA plan: header flight strip + grid / timeline / swimlane. */
const TnaPlanPage = () => {
  const { planId } = useParams();
  const { message } = App.useApp();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [ganttBaseline, setGanttBaseline] = useState(false);
  const [drawer, setDrawer] = useState({ type: null, line: null });

  const load = useCallback(() => {
    getPlan(planId)
      .then(setPlan)
      .catch(() => message.error('Failed to load TNA plan'))
      .finally(() => setLoading(false));
  }, [planId, message]);
  useEffect(load, [load]);

  const openActual = useCallback((line) => setDrawer({ type: 'actual', line }), []);
  const openReplan = useCallback((line) => setDrawer({ type: 'replan', line }), []);
  const closeDrawer = useCallback(() => setDrawer({ type: null, line: null }), []);
  const onSaved = useCallback(() => { closeDrawer(); load(); }, [closeDrawer, load]);

  if (loading) return <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>;
  if (!plan) return <EmptyState title="Plan not found" description="This order has no TNA plan, or the link is stale" />;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`TNA Plan — ${plan.orderNo}`}
        subtitle={`${plan.buyer} · ${plan.styleNo} · one row per activity, dates from the scheduling engine`}
        backPath="/tna/control-tower"
        extra={<Button icon={<HistoryOutlined />} onClick={() => setDrawer({ type: 'audit', line: null })}>Audit & versions</Button>}
      />
      <PlanHeaderStrip plan={plan} />
      <Card size="small" styles={{ body: { paddingTop: 12 } }}>
        <Segmented
          value={view}
          onChange={setView}
          style={{ marginBottom: 14 }}
          options={[
            { value: 'grid', label: 'Grid', icon: <TableOutlined /> },
            { value: 'timeline', label: 'Timeline', icon: <BarChartOutlined /> },
            { value: 'swimlane', label: 'Swimlane', icon: <AppstoreOutlined /> },
          ]}
        />
        {view === 'grid' && <PlanGrid plan={plan} onRecordActual={openActual} onProposeReplan={openReplan} />}
        {view === 'timeline' && <TnaGantt plan={plan} showBaseline={ganttBaseline} onToggleBaseline={setGanttBaseline} />}
        {view === 'swimlane' && <PlanSwimlane plan={plan} onOpenLine={(l) => !l.actualDate && openActual(l)} />}
      </Card>
      <ActualDrawer open={drawer.type === 'actual'} planId={plan.id} line={drawer.line} onClose={closeDrawer} onSaved={onSaved} />
      <ReplanDrawer open={drawer.type === 'replan'} plan={plan} line={drawer.line} onClose={closeDrawer} onSaved={onSaved} />
      <AuditDrawer open={drawer.type === 'audit'} planId={plan.id} onClose={closeDrawer} />
    </div>
  );
};

export default TnaPlanPage;
