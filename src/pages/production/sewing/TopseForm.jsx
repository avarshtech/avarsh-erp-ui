import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, Alert, DatePicker, Row, Col, Statistic, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { SEWING_LINES, DEFECT_CATEGORIES, DHU_THRESHOLD_PCT } from '../../../utils/sewingConstants';
import { getTopse, saveTopse, getOrders } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/** PRD 4.7 — TOPSE end-line defect log with DHU auto-calc and top-defect Pareto bars. */
const TopseForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords] = await Promise.all([isEdit ? getTopse(id) : Promise.resolve(null), getOrders()]);
        setOrders(ords);
        setReport(record || {
          orderId: ords[0]?.id, line: SEWING_LINES[0], date: dayjs().format('YYYY-MM-DD'),
          totalInspected: null, totalRework: null, defects: [],
        });
      } catch { message.error('Failed to load report'); } finally { setLoading(false); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);
  const setDefect = useCallback((idx, field, val) => {
    setReport((prev) => {
      const defects = prev.defects.map((x, i) => {
        if (i !== idx) return x;
        const next = { ...x, [field]: val };
        if (field === 'category') next.type = null;
        return next;
      });
      return { ...prev, defects };
    });
  }, []);

  const totals = useMemo(() => {
    if (!report) return null;
    const defects = report.defects.reduce((s, d) => s + (d.count || 0), 0);
    const dhu = report.totalInspected ? Math.round((defects / report.totalInspected) * 1000) / 10 : 0;
    const passRate = report.totalInspected ? Math.round(((report.totalInspected - (report.totalRework || 0)) / report.totalInspected) * 1000) / 10 : 0;
    const top = [...report.defects].filter((d) => d.count).sort((a, b) => b.count - a.count).slice(0, 5);
    const max = top[0]?.count || 1;
    return { defects, dhu, passRate, top, max };
  }, [report]);

  const columns = useMemo(() => [
    {
      title: 'Category', dataIndex: 'category', width: 190,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 175 }} placeholder="Category"
          options={Object.keys(DEFECT_CATEGORIES).map((c) => ({ value: c, label: c }))}
          onChange={(val) => setDefect(idx, 'category', val)} />
      ),
    },
    {
      title: 'Defect Type', dataIndex: 'type', width: 200,
      render: (v, r, idx) => (
        <FormSelect size="small" value={v} style={{ width: 185 }} placeholder="Type"
          options={(DEFECT_CATEGORIES[r.category] || []).map((t) => ({ value: t, label: t }))}
          onChange={(val) => setDefect(idx, 'type', val)} />
      ),
    },
    {
      title: 'Count', dataIndex: 'count', width: 100, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 80 }} onChange={(val) => setDefect(idx, 'count', val)} />,
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => setReport((prev) => ({ ...prev, defects: prev.defects.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [setDefect]);

  const handleSave = async () => {
    if (!report.totalInspected) return message.warning('Enter the total pieces inspected');
    setSaving(true);
    try {
      await saveTopse({ ...report, totalRework: report.totalRework || 0 });
      message.success('End-line report saved');
      navigate('/production/sewing?tab=topse');
    } catch { message.error('Failed to save report'); } finally { setSaving(false); }
  };

  if (loading || !report || !totals) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `End-Line Check — ${report.reportNo}` : 'New End-Line Check (TOPSE)'}
        backPath="/production/sewing?tab=topse"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Report" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Order</FieldLabel>
            <FormSelect value={report.orderId} style={{ width: 240 }} disabled={isEdit}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
              onChange={(v) => patch({ orderId: v })} />
          </div>
          <div>
            <FieldLabel>Line</FieldLabel>
            <FormSelect value={report.line} style={{ width: 110 }}
              options={SEWING_LINES.map((l) => ({ value: l, label: l }))} onChange={(v) => patch({ line: v })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(report.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Total Inspected</FieldLabel>
            <InputNumber min={0} value={report.totalInspected} style={{ width: 110 }} onChange={(v) => patch({ totalInspected: v })} />
          </div>
          <div>
            <FieldLabel>Sent for Rework</FieldLabel>
            <InputNumber min={0} value={report.totalRework} style={{ width: 110 }} onChange={(v) => patch({ totalRework: v })} />
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Total Defects" value={totals.defects} /></Card></Col>
        <Col xs={8} md={4}>
          <Card size="small">
            <Statistic title="DHU %" value={totals.dhu} suffix="%"
              styles={{ content: { color: totals.dhu > DHU_THRESHOLD_PCT ? 'var(--error-color)' : 'var(--success-color)' } }} />
          </Card>
        </Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Pass Rate %" value={totals.passRate} suffix="%" /></Card></Col>
      </Row>

      {totals.dhu > DHU_THRESHOLD_PCT && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`DHU ${totals.dhu}% exceeds the ${DHU_THRESHOLD_PCT}% threshold — automatic alert to QA Manager (PRD 4.7.3)`} />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            title="Defects Found"
            extra={(
              <Button icon={<PlusOutlined />} size="small"
                onClick={() => patch({ defects: [...report.defects, { category: null, type: null, count: null }] })}>
                Add Defect
              </Button>
            )}
          >
            <Table rowKey={(r) => report.defects.indexOf(r)} size="small" columns={columns} dataSource={report.defects} pagination={false}
              locale={{ emptyText: 'Log every defect with its category and type' }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Top Defects (Pareto)">
            {totals.top.length === 0
              ? <span style={{ color: 'var(--text-secondary)' }}>No defects logged yet</span>
              : totals.top.map((d) => (
                <div key={`${d.category}-${d.type}`} style={{ marginBottom: 10 }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                    <span>{d.type}</span><strong>{d.count}</strong>
                  </Space>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((d.count / totals.max) * 100)}%`, height: '100%', background: 'var(--error-color)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TopseForm;
