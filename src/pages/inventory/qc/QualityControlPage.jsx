import { useState, useCallback } from 'react';
import { Segmented } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import PermissionGuard from '../../../components/PermissionGuard';
import FabricQCList from './FabricQCList';
import TrimsQCList from './TrimsQCList';

/**
 * Quality Control landing page — segmented tab switcher between Fabric and Accessories.
 *
 * UI label convention (mirrors GRN): the trims half is surfaced to the user as
 * "Accessories" everywhere, matching the inventory vocabulary. The internal segment
 * value stays `Trims` to keep the route path and component API stable — only visible
 * labels are renamed.
 *
 * The "New Inspection" button is context-aware:
 *   - Fabric tab       → "New Fabric Inspection"       → /inventory/qc/fabric/new
 *   - Accessories tab  → "New Accessories Inspection"  → /inventory/qc/trims/new
 */
const QualityControlPage = () => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('Fabric');

  const isFabric = activeSegment === 'Fabric';

  const handleNewInspection = useCallback(() => {
    const path = isFabric
      ? '/inventory/qc/fabric/new'
      : '/inventory/qc/trims/new';
    navigate(path);
  }, [isFabric, navigate]);

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title="Quality Control"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <PermissionGuard module="inventory" operation="add">
          <ActionButton
            action="create"
            text={isFabric ? 'New Fabric Inspection' : 'New Accessories Inspection'}
            onClick={handleNewInspection}
          />
        </PermissionGuard>
      </PageHeader>

      <Segmented
        options={[
          { label: 'Fabric Quality Control', value: 'Fabric' },
          { label: 'Accessories Quality Control', value: 'Trims' },
        ]}
        value={activeSegment}
        onChange={setActiveSegment}
        block
        size="large"
        style={{
          marginBottom: 24,
          padding: 4,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg, 12px)',
        }}
      />

      {isFabric ? <FabricQCList embedded /> : <TrimsQCList embedded />}
    </div>
  );
};

export default QualityControlPage;
