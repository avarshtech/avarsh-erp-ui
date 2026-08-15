import { useCallback, useMemo } from 'react';
import { Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SewingDashboard from './SewingDashboard';
import SewingPlanList from './SewingPlanList';
import CutPartsReceiptList from './CutPartsReceiptList';
import GarmentIssueList from './GarmentIssueList';
import HourlyProductionTab from './HourlyProductionTab';
import TrimVerificationList from './TrimVerificationList';
import MeasurementReportList from './MeasurementReportList';
import TopseList from './TopseList';
import PartsReplacementList from './PartsReplacementList';
import OperatorSamTab from './OperatorSamTab';

/**
 * Sewing workspace — all sewing-floor screens as inner tabs (?tab= deep link),
 * in the PRD's operational workflow order.
 */
const SewingWorkspace = () => {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'dashboard';

  const handleTabChange = useCallback((key) => {
    setParams({ tab: key }, { replace: false });
  }, [setParams]);

  const items = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard', children: <SewingDashboard /> },
    { key: 'plan', label: 'Production Plan', children: <SewingPlanList /> },
    { key: 'receipt', label: 'Cut Parts Receipt', children: <CutPartsReceiptList /> },
    { key: 'issue', label: 'Garment Issue', children: <GarmentIssueList /> },
    { key: 'hourly', label: 'Hourly Production', children: <HourlyProductionTab /> },
    { key: 'trim-verification', label: 'Trim Verification', children: <TrimVerificationList /> },
    { key: 'measurement', label: 'Measurement', children: <MeasurementReportList /> },
    { key: 'topse', label: 'End-Line Check', children: <TopseList /> },
    { key: 'replacements', label: 'Replacements', children: <PartsReplacementList /> },
    { key: 'operators', label: 'Operators & SAM', children: <OperatorSamTab /> },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Sewing"
        subtitle="Sewing floor — cut parts in, hourly line tracking, quality gates (design preview on sample data)"
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

export default SewingWorkspace;
