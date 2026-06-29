import { useState } from 'react';
import { Segmented, Tabs } from 'antd';
import PageHeader from '../../../components/PageHeader';
import ReturnToSupplierForm from './ReturnToSupplierForm';
import ReturnToSupplierList from './ReturnToSupplierList';
import { RETURN_SEGMENTS, RETURN_TYPE } from '../../../utils/returnToSupplierConstants';

/**
 * Return to Supplier landing page (CRD_INV_004).
 *
 * Single page for Fabric and Accessories — toggled via Segmented, matching the
 * existing QC / Stock Register pattern. Inside each segment two tabs:
 *   New Return       → PO dropdown, rejected items, Save (generates Return DC + Debit Note)
 *   Return History   → list of past returns with debit note info
 */
const ReturnToSupplierPage = () => {
  const [activeType, setActiveType] = useState(RETURN_TYPE.FABRIC);
  const [activeTab, setActiveTab] = useState('new');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleReturnSaved = () => {
    setHistoryRefreshKey((k) => k + 1);
    setActiveTab('history');
  };

  const tabs = [
    {
      key: 'new',
      label: 'New Return',
      children: (
        <ReturnToSupplierForm
          returnType={activeType}
          onSaved={handleReturnSaved}
        />
      ),
    },
    {
      key: 'history',
      label: 'Return History',
      children: (
        <ReturnToSupplierList
          returnType={activeType}
          refreshKey={historyRefreshKey}
        />
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title="Return to Supplier"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />

      <Segmented
        options={RETURN_SEGMENTS}
        value={activeType}
        onChange={setActiveType}
        block
        size="large"
        style={{
          marginBottom: 24,
          padding: 4,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg, 12px)',
        }}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs}
        destroyOnHidden
      />
    </div>
  );
};

export default ReturnToSupplierPage;
