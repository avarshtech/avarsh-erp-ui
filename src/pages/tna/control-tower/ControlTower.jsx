import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Row } from 'antd';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import { listPlans, listReplans } from '../../../services/tna/tnaService';
import ControlTowerKpis from './ControlTowerKpis';
import OrderRiskTable from './OrderRiskTable';
import AttentionRail from './AttentionRail';

/** §15 — TNA Control Tower: every live order, one row, ranked by risk. */
const ControlTower = () => {
  const { message } = App.useApp();
  const [plans, setPlans] = useState([]);
  const [replans, setReplans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    Promise.all([listPlans(), listReplans()])
      .then(([p, r]) => { setPlans(p); setReplans(r); })
      .catch(() => message.error('Failed to load TNA control tower'))
      .finally(() => setLoading(false));
  }, [message]);

  const setFilter = useCallback((key) => (value) => setFilters((f) => ({ ...f, [key]: value })), []);
  const opts = useCallback((key) => [...new Set(plans.map((p) => p[key]))].map((v) => ({ value: v, label: v })), [plans]);

  const visible = useMemo(() => plans.filter((p) => (
    !['COMPLETED', 'CANCELLED'].includes(p.planStatus)
    && (!filters.search || `${p.orderNo} ${p.styleNo} ${p.buyer}`.toLowerCase().includes(filters.search.toLowerCase()))
    && (!filters.buyer || p.buyer === filters.buyer)
    && (!filters.merchandiser || p.merchandiser === filters.merchandiser)
    && (!filters.productType || p.productType === filters.productType)
    && (!filters.rag || p.rag === filters.rag)
  )), [plans, filters]);

  const filterDefs = useMemo(() => [
    { key: 'buyer', type: 'select', span: { md: 4 }, props: { placeholder: 'Buyer', options: opts('buyer'), onChange: setFilter('buyer') } },
    { key: 'merch', type: 'select', span: { md: 4 }, props: { placeholder: 'Merchandiser', options: opts('merchandiser'), onChange: setFilter('merchandiser') } },
    { key: 'ptype', type: 'select', span: { md: 4 }, props: { placeholder: 'Product type', options: opts('productType'), onChange: setFilter('productType') } },
    { key: 'rag', type: 'select', span: { md: 4 }, props: { placeholder: 'RAG', options: [{ value: 'RED', label: 'Delayed' }, { value: 'AMBER', label: 'At Risk' }, { value: 'GREEN', label: 'On Track' }], onChange: setFilter('rag') } },
  ], [opts, setFilter]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="TNA Control Tower"
        subtitle="Every live order in one view — ranked by risk, driven by projected dispatch (design preview on sample data)"
      />
      <ControlTowerKpis plans={plans} pendingReplans={replans.filter((r) => r.workflowStatus === 'PENDING_APPROVAL').length} loading={loading} />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Card size="small" styles={{ body: { paddingTop: 12 } }}>
            <SearchFilterBar
              searchText={filters.search}
              onSearchChange={(e) => setFilter('search')(e.target.value)}
              searchPlaceholder="Search order / style / buyer"
              filters={filterDefs}
              style={{ marginBottom: 12 }}
            />
            <OrderRiskTable plans={visible} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} xl={7}>
          <AttentionRail plans={plans} replans={replans} />
        </Col>
      </Row>
    </div>
  );
};

export default ControlTower;
