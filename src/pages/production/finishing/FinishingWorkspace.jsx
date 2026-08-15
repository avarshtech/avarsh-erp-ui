import { useCallback, useMemo } from 'react';
import { Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import FinishingDashboard from './FinishingDashboard';
import ReceivingList from './ReceivingList';
import FinishingHourlyTab from './FinishingHourlyTab';
import SpotWashTab from './SpotWashTab';
import CheckingList from './CheckingList';
import FinishingMeasurementList from './FinishingMeasurementList';
import AlterationList from './AlterationList';
import MetalDetectionTab from './MetalDetectionTab';
import ShadeSegregationTab from './ShadeSegregationTab';
import DefectsAqlTab from './DefectsAqlTab';

/**
 * Finishing workspace — PRD modules 1-10 as inner tabs (?tab= deep link),
 * in the 13-station process-flow order. Folding/Packing/Carton Audit follow
 * in the Packing design session.
 */
const FinishingWorkspace = () => {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'dashboard';

  const handleTabChange = useCallback((key) => {
    setParams({ tab: key }, { replace: false });
  }, [setParams]);

  const items = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard', children: <FinishingDashboard /> },
    { key: 'receiving', label: 'Receiving', children: <ReceivingList /> },
    { key: 'hourly', label: 'Hourly Stations', children: <FinishingHourlyTab /> },
    { key: 'spot-wash', label: 'Spot Wash', children: <SpotWashTab /> },
    { key: 'checking', label: 'Checking', children: <CheckingList /> },
    { key: 'measurement', label: 'Measurement', children: <FinishingMeasurementList /> },
    { key: 'alterations', label: 'Alterations', children: <AlterationList /> },
    { key: 'metal-detection', label: 'Metal Detection', children: <MetalDetectionTab /> },
    { key: 'shade', label: 'Shade Segregation', children: <ShadeSegregationTab /> },
    { key: 'defects-aql', label: 'Defects & AQL', children: <DefectsAqlTab /> },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Finishing"
        subtitle="Finishing floor — receiving to shade segregation, AQL 2.5 quality gates (design preview on sample data)"
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

export default FinishingWorkspace;
