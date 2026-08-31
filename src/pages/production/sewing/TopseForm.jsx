import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, DatePicker, Row, Col, Statistic, Button, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { SEWING_LINES, DEFECT_CATEGORIES, TOPSE_HOURS, topseTraffic, TOPSE_TRAFFIC_META, TOPSE_TRAFFIC } from '../../../utils/sewingConstants';
import { getTopse, saveTopse, getOrders } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const CATEGORY_COLORS = {
  'Fabric Defects': '#722ed1', 'Stitching Defects': '#fa541c', 'Construction Defects': '#1677ff',
  'Trim/Accessory Defects': '#13c2c2', 'Appearance Defects': '#faad14', 'Measurement Defects': '#eb2f96',
};

/** CR-SEW-006 — hour-wise digital defect tracking with live KPIs + traffic light. */
const TopseForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [record, ords] = await Promise.all([isEdit ? getTopse(id) : Promise.resolve(null), getOrders()]);
        setOrders(ords);
        setReport(record || {
          orderId: ords[0]?.id, line: SEWING_LINES[0], date: dayjs().format('YYYY-MM-DD'),
          totalInspected: null, defects: [],
        });
      } catch { message.error('Failed to load report'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);
  const setDefect = useCallback((idx, field, val) => {
    setReport((prev) => ({
      ...prev,
      defects: prev.defects.map((x, i) => {
        if (i !== idx) return x;
        const next = { ...x, [field]: val };
        if (field === 'category') next.type = null;
        if (field === 'count' && next.rework > (val || 0)) next.rework = val || 0;
        if (field === 'rework') next.rework = Math.min(val || 0, next.count || 0);
        return next;
      }),
    }));
  }, []);

  const totals = useMemo(() => {
    if (!report) return null;
    const defects = report.defects.reduce((s, d) => s + (d.count || 0), 0);
    const rework = report.defects.reduce((s, d) => s + (d.rework || 0), 0);
    const dhu = report.totalInspected ? Math.round((defects / report.totalInspected) * 1000) / 10 : 0;
    const passRate = report.totalInspected ? Math.round(((report.totalInspected - rework) / report.totalInspected) * 1000) / 10 : 0;
    const light = topseTraffic(dhu);
    const top = [...report.defects.reduce((m, d) => {
      if (!d.type || !d.count) return m;
      const key = `${d.category}|${d.type}`;
      m.set(key, { category: d.category, type: d.type, count: (m.get(key)?.count || 0) + d.count });
      return m;
    }, new Map()).values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const byHour = TOPSE_HOURS.map((h) => ({ hour: h, count: report.defects.filter((d) => d.hour === h).reduce((s, d) => s + (d.count || 0), 0) }));
    const maxHour = Math.max(0, ...byHour.map((h) => h.count));
    return { defects, rework, dhu, passRate, light, top, max: top[0]?.count || 1, byHour, maxHour };
  }, [report]);

  const columns = useMemo(() => [
    {
      title: 'Hour', dataIndex: 'hour', width: 100,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 85 }}
          options={TOPSE_HOURS.map((h) => ({ value: h, label: h }))} onChange={(val) => setDefect(idx, 'hour', val)} />
      ),
    },
    {
      title: 'Category', dataIndex: 'category', width: 185,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 170 }} placeholder="Category"
          options={Object.keys(DEFECT_CATEGORIES).map((c) => ({ value: c, label: c }))}
          onChange={(val) => setDefect(idx, 'category', val)} />
      ),
    },
    {
      title: 'Defect Type', dataIndex: 'type', width: 195,
      render: (v, r, idx) => (
        <FormSelect size="small" value={v} style={{ width: 180 }} placeholder="Type"
          options={(DEFECT_CATEGORIES[r.category] || []).map((t) => ({ value: t, label: t }))}
          onChange={(val) => setDefect(idx, 'type', val)} />
      ),
    },
    {
      title: 'Count', dataIndex: 'count', width: 90, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 70 }} onChange={(val) => setDefect(idx, 'count', val)} />,
    },
    {
      title: 'Sent to Rework', dataIndex: 'rework', width: 120, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} max={r.count || 0} value={v} style={{ width: 80, borderColor: 'var(--warning-color)' }}
          onChange={(val) => setDefect(idx, 'rework', val)} />
      ),
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
      await saveTopse({ ...report });
      message.success('End-line report saved');
      navigate('/production/sewing?tab=topse');
    } catch { message.error('Failed to save report'); } finally { setSaving(false); }
  };

  if (!report || !totals) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const lightMeta = TOPSE_TRAFFIC_META[totals.light];

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
            <FieldLabel>Work Order</FieldLabel>
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
            <FieldLabel>Traffic Light (GREEN ≤ {TOPSE_TRAFFIC.greenMax} · RED &gt; {TOPSE_TRAFFIC.yellowMax} — configurable per buyer)</FieldLabel>
            <Tag color={lightMeta.color} style={{ fontWeight: 700 }}>{totals.light} — {lightMeta.label}</Tag>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total Defects" value={totals.defects} styles={{ content: { color: totals.defects ? 'var(--error-color)' : undefined } }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Sent for Rework" value={totals.rework} styles={{ content: { color: totals.rework ? 'var(--warning-color)' : undefined } }} /></Card></Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic title="DHU %" value={totals.dhu} suffix="%"
              styles={{ content: { color: totals.light === 'GREEN' ? 'var(--success-color)' : totals.light === 'YELLOW' ? 'var(--warning-color)' : 'var(--error-color)' } }} />
          </Card>
        </Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Pass Rate %" value={totals.passRate} suffix="%" styles={{ content: { color: totals.passRate >= 95 ? 'var(--success-color)' : 'var(--warning-color)' } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={15}>
          <Card
            title="Defects Found (hour-wise)"
            extra={(
              <Button icon={<PlusOutlined />} size="small"
                onClick={() => patch({ defects: [...report.defects, { hour: 'Hr 1', category: 'Stitching Defects', type: 'Broken stitch', count: 1, rework: 0 }] })}>
                Add Defect
              </Button>
            )}
          >
            <Table rowKey={(r) => report.defects.indexOf(r)} size="small" columns={columns} dataSource={report.defects} pagination={false}
              scroll={{ x: 750 }} locale={{ emptyText: 'Log every defect with hour, category, type, count and rework' }} />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="Top Defects (Pareto)">
            {totals.top.length === 0
              ? <span style={{ color: 'var(--text-secondary)' }}>No defects logged yet</span>
              : totals.top.map((d) => (
                <div key={`${d.category}-${d.type}`} style={{ marginBottom: 10 }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                    <span>{d.type} <Tag color={CATEGORY_COLORS[d.category]} style={{ marginInlineStart: 4 }}>{d.category.replace(' Defects', '')}</Tag></span>
                    <strong>{d.count}</strong>
                  </Space>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((d.count / totals.max) * 100)}%`, height: '100%', background: CATEGORY_COLORS[d.category] || 'var(--error-color)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
          </Card>
        </Col>
      </Row>

      <Card title="Day Summary" size="small">
        <Space size="large" wrap align="center">
          <Tag color={lightMeta.color} style={{ fontSize: 14, padding: '4px 12px', fontWeight: 700 }}>{lightMeta.label.toUpperCase()}</Tag>
          <span>Inspected <strong>{report.totalInspected ?? 0}</strong></span>
          <span>Defects <strong>{totals.defects}</strong></span>
          <span>DHU <strong>{totals.dhu}%</strong></span>
          <span>Pass rate <strong>{totals.passRate}%</strong></span>
          <span>Rework <strong>{totals.rework}</strong></span>
          <span>Top defect <strong>{totals.top[0]?.type || '—'}</strong></span>
        </Space>
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Defects per hour</FieldLabel>
          <Space wrap>
            {totals.byHour.map((h) => (
              <Tag key={h.hour} color={h.count && h.count === totals.maxHour ? 'red' : h.count ? 'orange' : 'default'}>
                {h.hour}: {h.count}
              </Tag>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default TopseForm;
