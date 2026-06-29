import { useEffect, useState } from 'react';
import { Segmented, Alert, Button, Space } from 'antd';
import { ArrowRightOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import FabricStockRegister from './FabricStockRegister';
import AccessoriesStockRegister from './AccessoriesStockRegister';
import { getOpeningStockStatus } from '../../../services/inventory/openingStockService';
import { hasPermission } from '../../../utils/permissions';

const StockRegisterPage = () => {
  const [activeSegment, setActiveSegment] = useState('Fabric');
  const [openingStatus, setOpeningStatus] = useState(null);
  const navigate = useNavigate();

  // Fetch opening-stock status once to decide whether to show the first-day
  // banner. No-op failure: if the endpoint isn't reachable, just hide the
  // banner — the page is still usable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getOpeningStockStatus();
        if (!cancelled) setOpeningStatus(s);
      } catch {
        // silent — banner stays hidden
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showBanner = Boolean(
    openingStatus
    && !openingStatus.finalized
    && (openingStatus.draftCount + openingStatus.postedCount) === 0
    && hasPermission('opening-stock', 'add')
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Stock Register"
        sticky
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />

      {showBanner && (
        <Alert
          type="info"
          showIcon
          icon={<InboxOutlined />}
          style={{ marginBottom: 16 }}
          message="Is this Day 1 of your ERP?"
          description="Capture your existing stock balance as a one-time migration. After finalizing, all stock movements go through GRN or Stock Adjustment."
          action={
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/inventory/opening-stock')}
            >
              Capture Opening Stock
            </Button>
          }
        />
      )}

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
