import { useCallback, useMemo } from 'react';
import { Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import CuttingDashboard from './CuttingDashboard';
import FabricInTab from './FabricInTab';
import CutPlanningTab from './CutPlanningTab';
import LayAuditList from './LayAuditList';
import TmbCheckList from './TmbCheckList';
import CuttingReportTab from './CuttingReportTab';
import BundlingTab from './BundlingTab';
import ExternalProcessTab from './ExternalProcessTab';
import ReCutRegisterTab from './ReCutRegisterTab';
import ReconciliationTab from './ReconciliationTab';

/**
 * Cutting workspace — all cutting-room screens as inner tabs (?tab= deep link).
 * Mirrors the PRD cutting flow order: fabric in → planning → lay → TMB →
 * report → bundling → external process → re-cut → reconciliation.
 */
const CuttingWorkspace = () => {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'dashboard';

  const handleTabChange = useCallback((key) => {
    setParams({ tab: key }, { replace: false });
  }, [setParams]);

  const items = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard', children: <CuttingDashboard onNavigateTab={handleTabChange} /> },
    { key: 'fabric-in', label: 'Fabric In', children: <FabricInTab /> },
    { key: 'planning', label: 'Planning', children: <CutPlanningTab /> },
    { key: 'lay-audit', label: 'Lay Audit', children: <LayAuditList /> },
    { key: 'tmb', label: 'TMB Check', children: <TmbCheckList /> },
    { key: 'report', label: 'Cutting Report', children: <CuttingReportTab /> },
    { key: 'bundling', label: 'Bundling', children: <BundlingTab /> },
    { key: 'external', label: 'External Process', children: <ExternalProcessTab /> },
    { key: 'recut', label: 'Re-Cut Register', children: <ReCutRegisterTab /> },
    { key: 'reconciliation', label: 'Reconciliation', children: <ReconciliationTab /> },
  ], [handleTabChange]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Cutting"
        subtitle="Cutting room — fabric receipt to bundle issue (design preview on sample data)"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        destroyOnHidden
        tabBarStyle={{ marginBottom: 16 }}
      />
    </div>
  );
};

export default CuttingWorkspace;
