import { useState, useCallback } from 'react';
import { Segmented } from 'antd';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import FabricIssueList from './FabricIssueList';
import AccessoriesIssueList from './AccessoriesIssueList';

const MaterialIssuePage = () => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('Fabric');

  const handleNewIssue = useCallback(() => {
    const path = activeSegment === 'Fabric'
      ? '/inventory/issue/fabric/new'
      : '/inventory/issue/accessories/new';
    navigate(path);
  }, [activeSegment, navigate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Material Issue"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {hasPermission('inventory-issue', 'add') && (
          <ActionButton
            action="create"
            text={activeSegment === 'Fabric' ? 'New Fabric Issue' : 'New Accessories Issue'}
            onClick={handleNewIssue}
          />
        )}
      </PageHeader>

      <Segmented
        options={[
          { label: 'Fabric Material Issue', value: 'Fabric' },
          { label: 'Accessories Material Issue', value: 'Accessories' },
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
        <FabricIssueList embedded />
      ) : (
        <AccessoriesIssueList embedded />
      )}
    </div>
  );
};

export default MaterialIssuePage;
