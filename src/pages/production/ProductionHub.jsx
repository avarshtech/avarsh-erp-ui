import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Typography, App, List, Tag, Empty, Space } from 'antd';
import {
  ScissorOutlined, ToolOutlined, GiftOutlined, AppstoreOutlined,
  ClockCircleOutlined, WarningOutlined, AlertOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import PipelineStageCard from './components/PipelineStageCard';
import { PO_TYPE, PO_TYPE_META } from '../../utils/productionConstants';
import { getHubStats, getAttentionItems } from '../../services/production/productionService';

const { Text } = Typography;
const SEVERITY_COLOR = { error: 'red', warning: 'gold', info: 'blue' };

const STAGE_ICONS = {
  [PO_TYPE.CUTTING]: <ScissorOutlined />,
  [PO_TYPE.WORK_ORDER]: <ToolOutlined />,
  [PO_TYPE.FINISHING]: <GiftOutlined />,
};

const STAGES = [PO_TYPE.CUTTING, PO_TYPE.WORK_ORDER, PO_TYPE.FINISHING];
const STAT_KEY = { CUTTING: 'cutting', WORK_ORDER: 'workOrder', FINISHING: 'finishing' };

const ProductionHub = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [stats, setStats] = useState(null);
  const [attention, setAttention] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([getHubStats(), getAttentionItems()]);
      setStats(s); setAttention(a);
    } catch {
      message.error('Failed to load production summary');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const totalPos = stats ? stats.cutting.total + stats.workOrder.total + stats.finishing.total : 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Production Orders" subtitle="Plan & authorize Cutting, Sewing and Finishing for received goods" />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}><StatCard title="Total Production POs" value={totalPos} loading={loading} icon={<AppstoreOutlined />} color="var(--primary-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Pending Approvals" value={stats?.pendingApprovals || 0} loading={loading} icon={<ClockCircleOutlined />} color="#1677ff" /></Col>
        <Col xs={12} md={6}><StatCard title="Material Shortages" value={stats?.shortages || 0} loading={loading} icon={<WarningOutlined />} color="#cf1322" /></Col>
        <Col xs={12} md={6}><StatCard title="Variance Alerts" value={stats?.varianceAlerts || 0} loading={loading} icon={<AlertOutlined />} color="#d48806" /></Col>
      </Row>

      <Card
        title={<Text strong>Production Pipeline</Text>}
        style={{ borderRadius: 'var(--radius-lg)' }}
        styles={{ body: { padding: 20 } }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          {STAGES.map((type, idx) => (
            <PipelineStageCard
              key={type}
              meta={PO_TYPE_META[type]}
              icon={STAGE_ICONS[type]}
              stats={stats?.[STAT_KEY[type]]}
              loading={loading}
              showConnector={idx < STAGES.length - 1}
              onView={() => navigate(PO_TYPE_META[type].listPath)}
              onCreate={() => navigate(PO_TYPE_META[type].newPath)}
            />
          ))}
        </div>
        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          Goods flow left → right: cut fabric, sew garments, then finish & pack. Each stage is authorized by its own PO with planned quantity, material readiness and approval.
        </Text>
      </Card>

      <Card
        title={<Text strong>Needs Attention</Text>}
        style={{ borderRadius: 'var(--radius-lg)', marginTop: 24 }}
        styles={{ body: { padding: attention.length ? 0 : 20 } }}
      >
        {attention.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? 'Loading…' : 'All clear — nothing needs attention'} />
        ) : (
          <List
            dataSource={attention}
            renderItem={(it) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px 20px' }}
                onClick={() => navigate(PO_TYPE_META[it.poType].listPath)}
                actions={[<RightOutlined key="go" style={{ color: 'var(--text-secondary)' }} />]}
              >
                <List.Item.Meta
                  title={<Space><Text strong>{it.poNo}</Text><Tag color={SEVERITY_COLOR[it.severity]}>{it.reason}</Tag></Space>}
                  description={`${it.orderNo} · ${it.buyer}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default ProductionHub;
