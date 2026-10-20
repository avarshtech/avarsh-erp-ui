import {
  lazy, Suspense, useMemo, useState,
} from 'react';
import { Tabs } from 'antd';
import JobOrdersTab from './orders/JobOrdersTab';
import MaterialInTab from './materialIn/MaterialInTab';
import PartyStockTab from './stock/PartyStockTab';
import ReturnsTab from './returns/ReturnsTab';
import StatementsTab from './statements/StatementsTab';
import PrincipalsTab from './principals/PrincipalsTab';

const JobOrderDrawer = lazy(() => import('./orders/JobOrderDrawer'));
const NewJobOrderDrawer = lazy(() => import('./orders/NewJobOrderDrawer'));
const MaterialInDrawer = lazy(() => import('./materialIn/MaterialInDrawer'));
const ReturnDrawer = lazy(() => import('./returns/ReturnDrawer'));
const PrintPreviewDrawer = lazy(() => import('./components/PrintPreviewDrawer'));
const PrincipalDrawer = lazy(() => import('./principals/PrincipalDrawer'));

const TABS = ['orders', 'material-in', 'party-stock', 'returns', 'statements', 'principals'];

/**
 * Inward job work (UI mock round 2): work we do for other companies on their own material. Tabs share
 * the job order, Material In, return, print and principal drawers; a change anywhere bumps `refresh`.
 */
const InwardWorkspace = ({
  tab, onTab, refresh, changed, openOutwardJob,
}) => {
  const active = TABS.includes(tab) ? tab : 'orders';
  const [jobOrderId, setJobOrderId] = useState(null);
  const [newOrder, setNewOrder] = useState(false);
  const [inwardFor, setInwardFor] = useState(undefined);
  const [returnFor, setReturnFor] = useState(undefined);
  const [print, setPrint] = useState(null);
  const [principal, setPrincipal] = useState(undefined);

  const actions = useMemo(() => ({
    openJobOrder: setJobOrderId,
    newJobOrder: () => setNewOrder(true),
    recordInward: (id) => setInwardFor(id ?? null),
    newReturn: (id) => setReturnFor(id ?? null),
    openPrint: setPrint,
    editPrincipal: (p) => setPrincipal(p ?? null),
    openOutwardJob,
    changed,
  }), [openOutwardJob, changed]);

  const items = [
    { key: 'orders', label: 'Job Orders', children: <JobOrdersTab refresh={refresh} actions={actions} /> },
    { key: 'material-in', label: 'Material In', children: <MaterialInTab refresh={refresh} actions={actions} /> },
    { key: 'party-stock', label: 'Party Stock', children: <PartyStockTab refresh={refresh} actions={actions} /> },
    { key: 'returns', label: 'Returns', children: <ReturnsTab refresh={refresh} actions={actions} /> },
    { key: 'statements', label: 'Statements', children: <StatementsTab refresh={refresh} actions={actions} /> },
    { key: 'principals', label: 'Principals', children: <PrincipalsTab refresh={refresh} actions={actions} /> },
  ];

  return (
    <>
      <Tabs activeKey={active} onChange={onTab} items={items} tabBarStyle={{ marginBottom: 16 }} />
      <Suspense fallback={null}>
        {jobOrderId !== null && <JobOrderDrawer id={jobOrderId} onClose={() => setJobOrderId(null)} actions={actions} refresh={refresh} />}
        {newOrder && <NewJobOrderDrawer onClose={() => setNewOrder(false)} onSaved={(id) => { setNewOrder(false); changed(); setJobOrderId(id); }} />}
        {inwardFor !== undefined && <MaterialInDrawer jobOrderId={inwardFor} onClose={() => setInwardFor(undefined)} onSaved={changed} openPrint={setPrint} />}
        {returnFor !== undefined && <ReturnDrawer jobOrderId={returnFor} onClose={() => setReturnFor(undefined)} onSaved={changed} openPrint={setPrint} />}
        {print && <PrintPreviewDrawer title={print.title} html={print.html} onClose={() => setPrint(null)} />}
        {principal !== undefined && <PrincipalDrawer principal={principal} onClose={() => setPrincipal(undefined)} onSaved={changed} />}
      </Suspense>
    </>
  );
};

export default InwardWorkspace;
