import { useEffect, useState } from 'react';
import {
  Alert, App, Card, Col, Row, Select, Space, Tabs,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  listPlanOptions, listVersions, getBaselineComparison, getCommitments, getAuditTrail, getMeta,
} from '../../../services/tna/tnaService';
import MockDataNote from '../components/MockDataNote';
import VersionTable from './VersionTable';
import BaselineComparison from './BaselineComparison';
import CommitmentRegister from './CommitmentRegister';
import VersionCompare from './VersionCompare';
import AuditLog from './AuditLog';

const DEFAULT_PLAN = 1012;

/**
 * WF-06 — replaces the "Propose Re-plan" approval queue (FR-5.8). Versions are consequences
 * of source events already approved where they happened; this screen evidences, it does not approve.
 */
const RevisionsAudit = () => {
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const planId = Number(params.get('plan')) || DEFAULT_PLAN;
  const [options, setOptions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [result, setResult] = useState({ planId: null, versions: [], baseline: null, commitments: null, audit: [] });

  useEffect(() => {
    Promise.all([listPlanOptions(), getMeta()]).then(([o, m]) => { setOptions(o); setMeta(m); }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([listVersions(planId), getBaselineComparison(planId), getCommitments(planId), getAuditTrail(planId)])
      .then(([versions, baseline, commitments, audit]) => setResult({ planId, versions, baseline, commitments, audit }))
      .catch((e) => { message.error(e.message || 'Failed to load revisions'); setResult({ planId, versions: [], baseline: null, commitments: null, audit: [] }); });
  }, [planId, message]);
  const loading = result.planId !== planId;
  const data = loading ? { versions: [], baseline: null, commitments: null, audit: [] } : result;

  const selected = options.find((o) => o.id === planId);
  const tabs = [
    {
      key: 'versions',
      label: `Versions (${data.versions.length})`,
      children: (
        <>
          <VersionTable versions={data.versions} loading={loading} />
          <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
            <Col xs={24} xl={13}><BaselineComparison data={data.baseline} /></Col>
            <Col xs={24} xl={11}><CommitmentRegister data={data.commitments} /></Col>
          </Row>
        </>
      ),
    },
    { key: 'compare', label: 'Compare versions', children: <VersionCompare planId={planId} versions={data.versions} /> },
    { key: 'audit', label: `Audit log (${data.audit.length})`, children: <AuditLog rows={data.audit} /> },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Revisions & audit"
        subtitle={selected ? `${selected.orderNo} · ${selected.buyer} · ${selected.styleNo}` : 'Plan versions, baseline comparison and the commitment register'}
        extra={(
          <Space wrap>
            <MockDataNote asOf={meta?.asOf} />
            <Select
              showSearch
              name="plan"
              optionFilterProp="label"
              style={{ width: 320 }}
              value={planId}
              onChange={(v) => setParams({ plan: String(v) })}
              options={options.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.buyer}${o.status === 'CLOSED' ? ' · closed' : ''}` }))}
            />
          </Space>
        )}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 14 }}
        title="There is no approval queue in Time & Action"
        description="Each version below was created automatically by a change already approved in its own source screen — a sample deadline revision, a PO promise revision, a dispatch revision. T&A records the consequence; it does not ask for the decision a second time. Version 1 is the immutable baseline."
      />
      <Card size="small">
        {selected?.status === 'BLOCKED' && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="This order is blocked — no plan has been generated, so it has no versions yet." />}
        <Tabs items={tabs} />
      </Card>
    </div>
  );
};

export default RevisionsAudit;
