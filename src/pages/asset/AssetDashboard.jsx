import { useEffect, useState } from 'react';
import { App, Col, Row } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import { toastUnlessHandled } from '../../utils/apiError';
import { getAssetDashboard } from '../../services/asset/dashboardService';
import { statusMeta } from '../../utils/assetConstants';
import AssetKpiCards from './dashboard/AssetKpiCards';
import AssetTallyChart from './dashboard/AssetTallyChart';
import AssetPendingActions from './dashboard/AssetPendingActions';
import AssetRecentMovements from './dashboard/AssetRecentMovements';

/**
 * The palette the register's status tags use, as real colours.
 *
 * The tag colours are Ant Design preset names, which a Progress bar's
 * strokeColor cannot take, so the two are mapped here. A damaged bar is then
 * the same red as a damaged tag, which is the whole point of reusing them.
 */
const STROKE = {
  green: '#52c41a',
  cyan: '#13c2c2',
  orange: '#fa8c16',
  red: '#f5222d',
  blue: '#1677ff',
  default: '#bfbfbf',
};

const statusStroke = (status) => STROKE[statusMeta(status).color] ?? STROKE.default;
const statusLabel = (status) => statusMeta(status).label;

/**
 * The asset module's landing screen (PRD section L).
 *
 * Read-only, and nothing here is stored: every figure is counted in the
 * database when the screen asks. A dashboard that can disagree with the
 * register is worse than no dashboard, because somebody will act on the stale
 * number.
 *
 * Everything on it is a way in. The cards, the chart rows and the pending rows
 * all open the register or a queue already filtered to what they counted - a
 * number nobody can drill into is a number nobody can act on.
 */
const AssetDashboard = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getAssetDashboard()
      .then((loaded) => { if (!ignore) setData(loaded); })
      .catch((e) => { if (!ignore) toastUnlessHandled(message, e, 'Could not load the dashboard'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [message]);

  const go = (to) => navigate(to);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Dashboard"
        subtitle="The shape of the estate, and what is waiting on somebody"
        onBack={() => navigate('/assets')}
      >
        <ActionButton action="custom" text="Asset Register" onClick={() => navigate('/assets')} />
      </PageHeader>

      <AssetKpiCards stats={data ?? {}} loading={loading} onOpen={go} />

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <AssetTallyChart
            title="By category"
            rows={data?.byCategory ?? []}
            loading={loading}
            emptyText="No categories in use yet"
          />
        </Col>
        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <AssetTallyChart
            title="By unit"
            rows={data?.byUnit ?? []}
            loading={loading}
            emptyText="No assets placed yet"
          />
        </Col>
        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <AssetTallyChart
            title="By status"
            rows={data?.byStatus ?? []}
            loading={loading}
            colourOf={statusStroke}
            labelOf={statusLabel}
            emptyText="No assets yet"
            onRowClick={(row) => go(`/assets?status=${row.label}`)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          <AssetPendingActions pending={data?.pending} loading={loading} onOpen={go} />
        </Col>
        <Col xs={24} lg={14}>
          <AssetRecentMovements
            rows={data?.recentMovements ?? []}
            loading={loading}
            onOpen={(assetId) => navigate(`/assets/${assetId}`)}
          />
        </Col>
      </Row>
    </div>
  );
};

export default AssetDashboard;
