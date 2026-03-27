import { useState } from 'react';
import { Segmented } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import FabricStockRegister from './FabricStockRegister';
import AccessoriesStockRegister from './AccessoriesStockRegister';

const StockRegisterPage = () => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('Fabric');

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Stock Register"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {activeSegment === 'Fabric' && (
          <ActionButton action="view" text="Shade Lot View" onClick={() => navigate('/inventory/fabric-stock/shade-lots')} />
        )}
      </PageHeader>

      <Segmented
        options={[
          { label: 'Fabric Stock Register', value: 'Fabric' },
          { label: 'Accessories Stock Register', value: 'Accessories' },
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
        <FabricStockRegister embedded />
      ) : (
        <AccessoriesStockRegister embedded />
      )}
    </div>
  );
};

export default StockRegisterPage;
