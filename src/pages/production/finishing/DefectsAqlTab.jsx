import { useMemo, useState } from 'react';
import { Card, Table, Tag, Row, Col, InputNumber, Statistic, Space, Alert } from 'antd';
import { DEFECT_LIBRARY, DEFECT_SEVERITIES, AQL_25_TABLE } from '../../../utils/finishingConstants';
import { aqlSample } from '../../../services/production/finishingService';

/** PRD §17/§18 — defect library reference + interactive AQL 2.5 calculator. */
const DefectsAqlTab = () => {
  const [lotSize, setLotSize] = useState(380);
  const aql = useMemo(() => (lotSize ? aqlSample(lotSize) : null), [lotSize]);

  const libraryColumns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 80, render: (v) => <code>{v}</code> },
    { title: 'Defect', dataIndex: 'name' },
    {
      title: 'Severity', dataIndex: 'severity', width: 110,
      render: (v) => <Tag color={DEFECT_SEVERITIES[v].color}>{DEFECT_SEVERITIES[v].label}</Tag>,
    },
    { title: 'Rule', dataIndex: 'severity', key: 'rule', width: 260, render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{DEFECT_SEVERITIES[v].rule}</span> },
  ], []);

  const aqlColumns = useMemo(() => [
    { title: 'Lot Size', key: 'lot', render: (_, r) => `${r[0]} – ${r[1]}` },
    { title: 'Sample', dataIndex: 2, align: 'center' },
    { title: 'Accept (Ac)', dataIndex: 3, align: 'center', render: (v) => <span style={{ color: 'var(--success-color)' }}>{v}</span> },
    { title: 'Reject (Re)', dataIndex: 4, align: 'center', render: (v) => <span style={{ color: 'var(--error-color)' }}>{v}</span> },
  ], []);

  return (
    <Row gutter={16}>
      <Col xs={24} lg={14}>
        <Card title="Defect Library (QC Manager maintains; checkers pick from here)">
          <Table rowKey="code" size="small" columns={libraryColumns} dataSource={DEFECT_LIBRARY}
            pagination={false} scroll={{ x: 700 }} />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card title="AQL 2.5 Calculator" style={{ marginBottom: 16 }}>
          <Space size="large" align="end" wrap style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Lot Size (pcs)</div>
              <InputNumber min={2} max={35000} value={lotSize} style={{ width: 130 }} onChange={setLotSize} />
            </div>
            {aql && (
              <>
                <Statistic title="Sample" value={aql.sample} />
                <Statistic title="Accept ≤" value={aql.accept} styles={{ content: { color: 'var(--success-color)' } }} />
                <Statistic title="Reject ≥" value={aql.reject} styles={{ content: { color: 'var(--error-color)' } }} />
              </>
            )}
          </Space>
          <Alert type="info" showIcon
            title="Critical defects have zero tolerance — one critical rejects the whole lot regardless of sampling. Majors follow AQL 2.5; minors AQL 4.0." />
        </Card>
        <Card title="AQL 2.5 Sampling Table (PRD §17.2)">
          <Table rowKey={(r) => r[0]} size="small" columns={aqlColumns} dataSource={AQL_25_TABLE}
            pagination={false}
            rowClassName={(r) => (aql && lotSize >= r[0] && lotSize <= r[1] ? 'row-shortage' : '')} />
        </Card>
      </Col>
    </Row>
  );
};

export default DefectsAqlTab;
