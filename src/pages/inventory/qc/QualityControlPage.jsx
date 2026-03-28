import { useState, useCallback } from 'react';
import { Segmented } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import PermissionGuard from '../../../components/PermissionGuard';
import FabricQCList from './FabricQCList';
import TrimsQCList from './TrimsQCList';

const QualityControlPage = () => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('Fabric');

  const handleNewInspection = useCallback(() => {
    const path = activeSegment === 'Fabric'
      ? '/inventory/qc/fabric/new'
      : '/inventory/qc/trims/new';
    navigate(path);
  }, [activeSegment, navigate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Quality Control"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <PermissionGuard module="inventory" operation="add">
          <ActionButton action="create" text="New Inspection" onClick={handleNewInspection} />
        </PermissionGuard>
      </PageHeader>

      <Segmented
        options={[
          { label: 'Fabric Quality Control', value: 'Fabric' },
          { label: 'Trims Quality Control', value: 'Trims' },
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

      {activeSegment === 'Fabric' ? (
        <FabricQCList embedded />
      ) : (
        <TrimsQCList embedded />
      )}
    </div>
  );
};

export default QualityControlPage;
