import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Card, Col, Form, Input, Modal, Row, Segmented, Space,
} from 'antd';
import {
  StopOutlined, WarningOutlined, CloseCircleOutlined, ThunderboltOutlined, CopyOutlined, SyncOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import {
  listExceptions, getSyncStatus, getReconciliation, resolveException, getMeta,
} from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { currentUserName, fmtDateTime } from '../../../utils/tnaConstants';
import MockDataNote from '../components/MockDataNote';
import AcknowledgeInfeasibleModal from '../components/AcknowledgeInfeasibleModal';
import ExceptionTable from './ExceptionTable';
import { SyncStatusPanel, ReconciliationPanel } from './SyncPanels';

/**
 * WF-08 — nothing is silently assumed: every unresolved link, missing input, infeasible
 * commitment, provisional plan and source gap is listed here (FR-10.5/10.6, §11.7).
 */
const ExceptionsConsole = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [data, setData] = useState(null);
  const [sync, setSync] = useState([]);
  const [recon, setRecon] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('OPEN');
  const [resolving, setResolving] = useState(null);
  const [acking, setAcking] = useState(null);
  const [saving, setSaving] = useState(false);
  const canAct = hasPermission('tna', 'update');

  const load = useCallback(() => {
    Promise.all([listExceptions(), getSyncStatus(), getReconciliation(), getMeta()])
      .then(([e, s, r, m]) => { setData(e); setSync(s); setRecon(r); setMeta(m); })
      .catch(() => message.error('Failed to load exceptions'))
      .finally(() => setLoading(false));
  }, [message]);
  useEffect(load, [load]);

  const rows = useMemo(() => (data?.rows || [])
    .filter((x) => scope === 'ALL' || x.status === 'OPEN')
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'BLOCK' ? -1 : 1)), [data, scope]);

  const submitResolve = async () => {
    const { note } = await form.validateFields();
    setSaving(true);
    try {
      const res = await resolveException(resolving.id, { by: currentUserName(), note });
      message.success(res.regenerated ? `${resolving.orderNo}: link resolved — plan generated (${res.regenerated.toLowerCase()})` : 'Marked as corrected in the source');
      setResolving(null);
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const k = data?.kpis || {};
  const kpis = [
    { title: 'Blocking — plan not generated', value: k.blocking, icon: <StopOutlined />, color: 'var(--error-color)' },
    { title: 'Warnings — plan provisional or flagged', value: k.warnings, icon: <WarningOutlined />, color: 'var(--warning-color)' },
    { title: 'Failed events after retry', value: k.failedEvents, icon: <CloseCircleOutlined />, color: 'var(--error-color)' },
    { title: 'Events processed (7 days)', value: k.eventsProcessed7d, icon: <ThunderboltOutlined />, color: 'var(--primary-color)' },
    { title: 'Duplicates suppressed', value: k.duplicatesSuppressed, icon: <CopyOutlined />, color: 'var(--text-secondary)' },
    { title: 'Last reconciliation', value: k.lastReconciliation ? fmtDateTime(k.lastReconciliation).slice(12) : '—', icon: <SyncOutlined />, color: 'var(--success-color)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Exceptions & data quality"
        subtitle="Unresolved identity blocks plan generation rather than producing a guessed plan"
        extra={<MockDataNote asOf={meta?.asOf} />}
      />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {kpis.map((c) => <Col key={c.title} xs={12} md={8} xl={4}><StatCard {...c} value={c.value ?? 0} loading={loading} /></Col>)}
      </Row>
      <Card size="small" style={{ marginBottom: 14 }}>
        <Space style={{ marginBottom: 12 }}>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'OPEN', label: 'Open' }, { value: 'ALL', label: 'All, incl. resolved' }]} />
        </Space>
        <ExceptionTable rows={rows} loading={loading} asOf={meta?.asOf} canAct={canAct} onResolve={setResolving} onAcknowledge={setAcking} />
      </Card>
      <Row gutter={[14, 14]}>
        <Col xs={24} xl={14}><SyncStatusPanel rows={sync} loading={loading} /></Col>
        <Col xs={24} xl={10}><ReconciliationPanel data={recon} loading={loading} /></Col>
      </Row>
      <Modal
        open={!!resolving}
        title={resolving?.type === 'IDENTITY_UNRESOLVED' ? `Resolve identity — ${resolving?.orderNo}` : `Mark corrected — ${resolving?.orderNo}`}
        okText={resolving?.type === 'IDENTITY_UNRESOLVED' ? 'Resolve and generate plan' : 'Mark corrected'}
        onOk={submitResolve}
        onCancel={() => setResolving(null)}
        confirmLoading={saving}
        destroyOnHidden
      >
        <p style={{ fontSize: 13 }}>{resolving?.detail}</p>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="note"
            label={resolving?.type === 'IDENTITY_UNRESOLVED' ? 'Explicit mapping (auditable — never a similarity match)' : 'What was corrected in the source'}
            rules={[{ required: true, message: 'A note is required' }, { max: 300 }]}
          >
            <Input.TextArea rows={3} maxLength={300} showCount placeholder={resolving?.unresolvedValue ? `${resolving.unresolvedValue} → ${resolving.orderNo} line 1` : ''} />
          </Form.Item>
        </Form>
      </Modal>
      <AcknowledgeInfeasibleModal open={!!acking} planId={acking?.orderId} orderNo={acking?.orderNo} onClose={() => setAcking(null)} onDone={() => { setAcking(null); load(); }} />
    </div>
  );
};

export default ExceptionsConsole;
