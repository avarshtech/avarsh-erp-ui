import { useState, useCallback } from 'react';
import { Segmented } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import FabricIssueList from './FabricIssueList';
import AccessoriesIssueList from './AccessoriesIssueList';
import SampleRequestIssuePane from './SampleRequestIssuePane';

const NEW_ISSUE_PATH = {
  Fabric: '/inventory/issue/fabric/new',
  Accessories: '/inventory/issue/accessories/new',
  SampleRequest: '/inventory/issue/sample/new',
};
const NEW_ISSUE_TEXT = {
  Fabric: 'New Fabric Issue',
  Accessories: 'New Accessories Issue',
  SampleRequest: 'New Sample Issue',
};

const MaterialIssuePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?segment= lets a form return the user to the segment they came from
  const [activeSegment, setActiveSegment] = useState(() => {
    const requested = searchParams.get('segment');
    // hasOwn, not a bare lookup — 'constructor'/'toString' would pass truthiness
    return Object.prototype.hasOwnProperty.call(NEW_ISSUE_PATH, requested) ? requested : 'Fabric';
  });

  const handleNewIssue = useCallback(() => {
    navigate(NEW_ISSUE_PATH[activeSegment]);
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
            text={NEW_ISSUE_TEXT[activeSegment]}
            onClick={handleNewIssue}
          />
        )}
      </PageHeader>

      <Segmented
        options={[
          { label: 'Fabric Material Issue', value: 'Fabric' },
          { label: 'Accessories Material Issue', value: 'Accessories' },
          { label: 'Sample Request Issue', value: 'SampleRequest' },
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

      {activeSegment === 'Fabric' && <FabricIssueList embedded />}
      {activeSegment === 'Accessories' && <AccessoriesIssueList embedded />}
      {activeSegment === 'SampleRequest' && <SampleRequestIssuePane />}
    </div>
  );
};

export default MaterialIssuePage;
