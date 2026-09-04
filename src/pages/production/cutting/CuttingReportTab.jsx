import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Row, Col, Spin } from 'antd';
import { InboxOutlined, ScissorOutlined, WarningOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import StatCard from '../../../components/StatCard';
import { formatNumber } from '../../../utils/formatters';
import { getCuttingReport, getCutPos } from '../../../services/production/cuttingService';
import CuttingReportPivot from './CuttingReportPivot';

/** FR-05 — size-wise cutting progress with ratio-based lay entries and fabric balance. */
const CuttingReportTab = () => {
  const { message } = App.useApp();
  const { selectCutPo, defaultCutPoId } = useModuleSelection('cutting');
  const [cutPos, setCutPos] = useState([]);
  const [cutPoId, setCutPoId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCutPos().then((pos) => { setCutPos(pos); setCutPoId(defaultCutPoId(pos)); })
      .catch(() => message.error('Failed to load Cut POs'));
  }, [message, defaultCutPoId]);

  const load = useCallback(async () => {
    if (!cutPoId) return;
    setLoading(true);
    try { setReport(await getCuttingReport(cutPoId)); }
    catch { message.error('Failed to load cutting report'); } finally { setLoading(false); }
  }, [cutPoId, message]);

  useEffect(() => { load(); }, [load]);

  const balanceKg = useMemo(() => (report ? report.fabricReceived - report.fabricRequired : 0), [report]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Cut PO</div>
            <FormSelect value={cutPoId} style={{ width: 280 }}
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo} · ${p.color}` }))}
              onChange={(v) => { selectCutPo(cutPos.find((p) => p.id === v)); setCutPoId(v); }} />
          </div>
          {report && (
            <Space size="large" wrap style={{ color: 'var(--text-secondary)' }}>
              <span>Buyer: <strong>{report.cutPo.buyer}</strong></span>
              <span>Buyer PO: <strong>{report.cutPo.buyerPoNo}</strong></span>
              <span>Cons: <strong>{report.cutPo.consumption} {report.cutPo.consumptionUom}</strong></span>
              <span>Width: <strong>{report.cutPo.width}"</strong></span>
              <span>Realize: <strong>{report.cutPo.realizePct}%</strong></span>
            </Space>
          )}
        </Space>
      </Card>

      {loading || !report ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <StatCard title="Fabric Required (kg)" value={formatNumber(report.fabricRequired, 3)} color="var(--primary-color)" icon={<ScissorOutlined />} />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard title="Fabric Received (kg)" value={formatNumber(report.fabricReceived, 3)} color="var(--success-color)" icon={<InboxOutlined />} />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard title={balanceKg < 0 ? 'Balance — Shortage (kg)' : 'Balance (kg)'} value={formatNumber(balanceKg, 3)}
                color={balanceKg < 0 ? 'var(--error-color)' : 'var(--success-color)'} icon={<WarningOutlined />} />
            </Col>
          </Row>
          <CuttingReportPivot report={report} onLayAdded={load} />
        </>
      )}
    </div>
  );
};

export default CuttingReportTab;
