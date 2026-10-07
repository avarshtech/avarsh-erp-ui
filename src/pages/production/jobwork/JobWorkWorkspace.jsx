import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import {
  App, Button, Popconfirm, Segmented, Skeleton, Tabs, Tag,
} from 'antd';
import { ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { resetDemoData } from '../../../services/production/jobwork/jobWorkTrackerApi';
import { resetInwardDemoData } from '../../../services/production/jobwork/jobWorkInwardApi';
import JobTrackerTab from './tracker/JobTrackerTab';
import DailyUpdateTab from './daily/DailyUpdateTab';
import ReceiptsTab from './receipts/ReceiptsTab';
import PullBacksTab from './pullback/PullBacksTab';
import OrderSplitTab from './split/OrderSplitTab';
import MaterialsTab from './materials/MaterialsTab';

const JobViewDrawer = lazy(() => import('./tracker/JobViewDrawer'));
const ReceiptDrawer = lazy(() => import('./receipts/ReceiptDrawer'));
const PullBackDrawer = lazy(() => import('./pullback/PullBackDrawer'));
const InwardWorkspace = lazy(() => import('./inward/InwardWorkspace'));

const DIRECTIONS = [{ value: 'out', label: 'Outward — we give work' }, { value: 'in', label: 'Inward — we work for others' }];
const SUBTITLE = {
  out: 'Outsourced jobs at vendors — daily status, receipts and pull-backs (design preview on sample data)',
  in: 'Work we do for other companies on their material — their stock, our lines, returns and job charges (design preview on sample data)',
};

/**
 * Job Work — both directions (UI mock rounds 1 and 2, demo data in the browser). Outward tabs share
 * three drawers (job, receipt, pull-back) and one `refresh` counter: any change made in a drawer or tab
 * bumps it and every tab reloads. The outward tabs stay mounted while Inward is shown, so a half-typed
 * daily sheet survives, and the job drawer can open over Inward for the printing job both share.
 */
const JobWorkWorkspace = () => {
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const dir = params.get('dir') === 'in' ? 'in' : 'out';
  const activeTab = dir === 'out' ? params.get('tab') || 'tracker' : 'tracker';
  const [refresh, setRefresh] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [receiptJobId, setReceiptJobId] = useState(undefined);
  const [pullBack, setPullBack] = useState(null);
  const [dailyPreset, setDailyPreset] = useState(null);

  const changed = useCallback(() => setRefresh((n) => n + 1), []);
  const goTab = useCallback((key) => setParams({ tab: key }, { replace: false }), [setParams]);
  const goInwardTab = useCallback((key) => setParams({ dir: 'in', tab: key }, { replace: false }), [setParams]);
  const openDaily = useCallback((vendorId) => {
    setDailyPreset({ vendorId, at: Date.now() });
    setJobId(null);
    goTab('daily');
  }, [goTab]);

  const actions = useMemo(() => ({
    openJob: setJobId,
    openReceipt: (id) => setReceiptJobId(id ?? null),
    openPullBack: setPullBack,
    openDaily,
    changed,
  }), [openDaily, changed]);

  const items = useMemo(() => [
    { key: 'tracker', label: 'Tracker', children: <JobTrackerTab refresh={refresh} actions={actions} /> },
    { key: 'daily', label: 'Daily Update', forceRender: true, children: <DailyUpdateTab refresh={refresh} actions={actions} preset={dailyPreset} /> },
    { key: 'receipts', label: 'Receipts', children: <ReceiptsTab refresh={refresh} actions={actions} /> },
    { key: 'pullbacks', label: 'Pull-backs', children: <PullBacksTab refresh={refresh} actions={actions} /> },
    { key: 'split', label: 'Order Split', children: <OrderSplitTab refresh={refresh} actions={actions} /> },
    { key: 'materials', label: 'Materials', children: <MaterialsTab refresh={refresh} actions={actions} /> },
  ], [refresh, actions, dailyPreset]);

  const reset = async () => {
    await resetDemoData();
    await resetInwardDemoData(); // seeded from the outward demo's date, so it goes second
    setJobId(null);
    setPullBack(null);
    changed();
    message.success('Demo data reset to today, on both sides.');
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Job Work"
        subtitle={SUBTITLE[dir]}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
        extra={[
          <Segmented key="dir" value={dir} options={DIRECTIONS} onChange={(v) => setParams(v === 'in' ? { dir: 'in' } : {})} />,
          <Tag key="mock" color="purple" icon={<ExperimentOutlined />}>Mock — no data is saved to the server</Tag>,
          <Popconfirm key="reset" title="Reset the demo data?" description="Every change made in this preview, on both sides, is lost." onConfirm={reset}>
            <Button icon={<ReloadOutlined />}>Reset demo data</Button>
          </Popconfirm>,
        ]}
      />
      <div style={{ display: dir === 'out' ? undefined : 'none' }}>
        <Tabs activeKey={activeTab} onChange={goTab} items={items} tabBarStyle={{ marginBottom: 16 }} />
      </div>
      <Suspense fallback={<Skeleton active />}>
        {dir === 'in' && <InwardWorkspace tab={params.get('tab')} onTab={goInwardTab} refresh={refresh} changed={changed} openOutwardJob={setJobId} />}
        {jobId !== null && <JobViewDrawer jobId={jobId} onClose={() => setJobId(null)} actions={actions} refresh={refresh} />}
        {receiptJobId !== undefined && (
          <ReceiptDrawer jobId={receiptJobId} onClose={() => setReceiptJobId(undefined)} onSaved={changed} />
        )}
        {pullBack && <PullBackDrawer target={pullBack} onClose={() => setPullBack(null)} actions={actions} refresh={refresh} />}
      </Suspense>
    </div>
  );
};

export default JobWorkWorkspace;
