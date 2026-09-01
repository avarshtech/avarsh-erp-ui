import { useMemo, useState } from 'react';
import { Card, Tabs } from 'antd';
import {
  DeploymentUnitOutlined, ToolOutlined, ScissorOutlined, BugOutlined,
  UnorderedListOutlined, DollarOutlined, ColumnHeightOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import ProductionLineMaster from './ProductionLineMaster';
import MachineTypeMaster from './MachineTypeMaster';
import SewingOperationMaster from './SewingOperationMaster';
import SewingDefectTypeMaster from './SewingDefectTypeMaster';
import SewingLookupMaster from './SewingLookupMaster';
import IncentiveSlabMaster from './IncentiveSlabMaster';
import MeasurementChartMaster from './MeasurementChartMaster';

const TABS = [
  { key: 'lines', label: 'Production Lines', icon: <DeploymentUnitOutlined />, Component: ProductionLineMaster },
  { key: 'machines', label: 'Machine Types', icon: <ToolOutlined />, Component: MachineTypeMaster },
  { key: 'operations', label: 'Operations', icon: <ScissorOutlined />, Component: SewingOperationMaster },
  { key: 'defects', label: 'Defect Types', icon: <BugOutlined />, Component: SewingDefectTypeMaster },
  { key: 'lookups', label: 'Lookups & Thresholds', icon: <UnorderedListOutlined />, Component: SewingLookupMaster },
  { key: 'incentives', label: 'Incentive Slabs', icon: <DollarOutlined />, Component: IncentiveSlabMaster },
  { key: 'charts', label: 'Measurement Charts', icon: <ColumnHeightOutlined />, Component: MeasurementChartMaster },
];

/**
 * Everything the production floor can configure, in one place. These are the
 * lists the cutting, sewing and finishing screens read from — editing a line,
 * an efficiency band or an incentive slab happens here rather than through the
 * API.
 */
const ProductionMastersPage = () => {
  const [activeKey, setActiveKey] = useState(TABS[0].key);

  // Only the open tab is mounted, so seven masters do not all fetch at once.
  const ActiveMaster = useMemo(
    () => TABS.find((tab) => tab.key === activeKey)?.Component ?? null, [activeKey],
  );

  const items = useMemo(() => TABS.map(({ key, label, icon }) => ({
    key,
    label: <span>{icon} {label}</span>,
  })), []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Production Masters"
        subtitle="The lists the production floor screens read from — lines, machines, operations, defects, thresholds and incentive slabs"
      />
      <Card styles={{ body: { paddingTop: 8 } }}>
        <Tabs items={items} activeKey={activeKey} onChange={setActiveKey} size="small" />
        {ActiveMaster && <ActiveMaster />}
      </Card>
    </div>
  );
};

export default ProductionMastersPage;
