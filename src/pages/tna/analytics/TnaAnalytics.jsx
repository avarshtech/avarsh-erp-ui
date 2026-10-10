import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Col, Row, Segmented, Select, Space,
} from 'antd';
import {
  ShoppingOutlined, ClockCircleOutlined, CheckCircleOutlined, SwapOutlined, FieldTimeOutlined, QuestionCircleOutlined, DownloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import { getAnalytics, getSettings } from '../../../services/tna/tnaService';
import { ATTRIBUTION } from '../../../utils/tnaConstants';
import { downloadCsv } from '../../../utils/download';
import MockDataNote from '../components/MockDataNote';
import {
  AttributionPanel, CommitmentMovementPanel, ExposurePanel, MasterBiasPanel,
} from './AnalyticsPanels';

const PERIODS = [{ value: 3, label: '3 months' }, { value: 6, label: '6 months' }, { value: 12, label: '12 months' }, { value: 0, label: 'All' }];

/**
 * WF-07 — on-time performance against both commitments side by side (FR-11.2), attribution as a
 * share of net order impact (FR-11.6), commitment movement apart from delay (FR-7.6), and
 * "Reason unavailable" as its own category (FR-7.9).
 */
const TnaAnalytics = () => {
  const { message } = App.useApp();
  const [filters, setFilters] = useState({ months: 6, buyer: null });
  const [result, setResult] = useState({ key: null, data: null });
  const [ceiling, setCeiling] = useState(10);
  const key = `${filters.months}|${filters.buyer || ''}`;

  useEffect(() => { getSettings().then((s) => setCeiling(s.reasonUnavailableCeilingPct)).catch(() => {}); }, []);
  useEffect(() => {
    getAnalytics(filters)
      .then((data) => setResult({ key, data }))
      .catch(() => { message.error('Failed to load analytics'); setResult({ key, data: null }); });
  }, [filters, key, message]);
  const loading = result.key !== key;
  const data = result.data;

  const exportCsv = useCallback(() => {
    downloadCsv([
      ['Attributed to', 'Evidence source', 'Orders', 'Mean impact (CD)', 'Share %'],
      ...(data?.attribution || []).map((r) => [ATTRIBUTION[r.category]?.label || r.category, r.evidenceSource, r.orders, r.meanImpact, r.share]),
    ], `tna-delay-attribution-${data?.asOf}.csv`);
  }, [data]);

  const k = data?.kpis || {};
  const cards = [
    { title: 'Orders dispatched in period', value: k.orders, icon: <ShoppingOutlined />, color: 'var(--primary-color)' },
    { title: 'Dispatched late vs original', value: k.lateVsOriginalPct, suffix: '%', icon: <ClockCircleOutlined />, color: 'var(--error-color)' },
    { title: 'On time vs latest', value: k.onTimeVsLatestPct, suffix: '%', icon: <CheckCircleOutlined />, color: 'var(--success-color)' },
    { title: 'Orders with commitment revisions', value: k.ordersWithRevisions, icon: <SwapOutlined />, color: 'var(--info-color, #3b82f6)' },
    { title: 'Mean execution delay', value: k.meanExecutionDelay, suffix: 'CD', icon: <FieldTimeOutlined />, color: 'var(--warning-color)' },
    { title: 'Reason unavailable', value: k.reasonUnavailablePct, suffix: '%', icon: <QuestionCircleOutlined />, color: k.reasonUnavailablePct > ceiling ? 'var(--error-color)' : 'var(--text-secondary)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="T&A analytics"
        subtitle="Delay attribution and commitment movement, reported separately — closed orders by dispatch date"
        extra={(
          <Space wrap>
            <MockDataNote asOf={data?.asOf} />
            <Segmented value={filters.months} onChange={(v) => setFilters((f) => ({ ...f, months: v }))} options={PERIODS} />
            <Select allowClear name="buyer" placeholder="Buyer: all" style={{ width: 150 }} value={filters.buyer} onChange={(v) => setFilters((f) => ({ ...f, buyer: v || null }))} options={(data?.buyers || []).map((b) => ({ value: b, label: b }))} />
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!data}>Export</Button>
          </Space>
        )}
      />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {cards.map((c) => <Col key={c.title} xs={12} md={8} xl={4}><StatCard {...c} value={c.value ?? 0} loading={loading} /></Col>)}
      </Row>
      <Row gutter={[14, 14]}>
        <Col xs={24} xl={13}><AttributionPanel rows={data?.attribution || []} ceilingPct={ceiling} /></Col>
        <Col xs={24} xl={11}><CommitmentMovementPanel rows={data?.commitmentByBuyer || []} /></Col>
        <Col xs={24} xl={11}><ExposurePanel rows={data?.exposure || []} /></Col>
        <Col xs={24} xl={13}><MasterBiasPanel rows={data?.masterBias || []} /></Col>
      </Row>
    </div>
  );
};

export default TnaAnalytics;
