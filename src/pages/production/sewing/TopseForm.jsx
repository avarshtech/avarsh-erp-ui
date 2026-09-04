import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, DatePicker, Row, Col, Statistic, Button, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { searchEmployees } from '../../../services/hr/employeeService';
import { TOPSE_TRAFFIC_META, CATEGORY_COLORS, topseHourOptions } from '../../../utils/sewingConstants';
import { topseTotals } from '../../../utils/sewingCalc';
import { getTopse, saveTopse, getOrders } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const HOUR_OPTIONS = topseHourOptions();

/** CR-SEW-006 — hour-wise digital defect tracking with live KPIs + traffic light. */
const TopseForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { lineOptions, defectCategories, defectTypesOf, threshold } = useSewingMasters();
  const { selectOrder, defaultOrderId } = useModuleSelection('sewing');
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

  const greenMax = threshold('TOPSE_GREEN_MAX_DHU', 3);
  const yellowMax = threshold('TOPSE_YELLOW_MAX_DHU', 5);

  useEffect(() => {
    (async () => {
      try {
        const [record, ords, staff] = await Promise.all([
          isEdit ? getTopse(id) : Promise.resolve(null),
          getOrders(),
          searchEmployees({ status: 'ACTIVE', size: 200 }),
        ]);
        setOrders(ords);
        setEmployees(staff.content);
        setReport(record || {
          orderId: defaultOrderId(ords), lineId: null, reportDate: dayjs().format('YYYY-MM-DD'),
          totalInspected: null, inspectorId: null, defects: [],
        });
      } catch { message.error('Failed to load the report'); }
    })();
    // The remembered order only seeds a new record; it must not reload the
    // form when another screen in the module changes the selection mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, message]);

  // Default the line once the master has loaded, rather than assuming a name.
  useEffect(() => {
    if (!report || report.lineId || !lineOptions.length) return;
    setReport((prev) => ({ ...prev, lineId: lineOptions[0].value }));
  }, [report, lineOptions]);

  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);

  const setDefect = useCallback((idx, field, val) => {
    setReport((prev) => ({
      ...prev,
      defects: prev.defects.map((x, i) => {
        if (i !== idx) return x;
        const next = { ...x, [field]: val };
        // A defect type belongs to one category, so changing the category
        // invalidates the type rather than leaving a mismatched pair.
        if (field === 'category') { next.defectTypeId = null; next.defectType = null; }
        if (field === 'defectTypeId') {
          next.defectType = defectTypesOf(next.category).find((t) => t.id === val)?.name ?? null;
        }
        // Rework is a subset of the defects found, both ways round.
        if (field === 'count') next.rework = Math.min(next.rework || 0, val || 0);
        if (field === 'rework') next.rework = Math.min(val || 0, next.count || 0);
        return next;
      }),
    }));
  }, [defectTypesOf]);

  const totals = useMemo(
    () => topseTotals(report?.defects || [], report?.totalInspected, greenMax, yellowMax),
    [report?.defects, report?.totalInspected, greenMax, yellowMax],
  );

  const columns = useMemo(() => [
    {
      title: 'Hour', dataIndex: 'hour', width: 100,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 85 }} options={HOUR_OPTIONS}
          onChange={(val) => setDefect(idx, 'hour', val)} />
      ),
    },
    {
      title: 'Category', dataIndex: 'category', width: 185,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 170 }} placeholder="Category"
          options={defectCategories.map((c) => ({ value: c, label: c }))}
          onChange={(val) => setDefect(idx, 'category', val)} />
      ),
    },
    {
      title: 'Defect Type', dataIndex: 'defectTypeId', width: 195,
      render: (v, r, idx) => (
        <FormSelect size="small" value={v} style={{ width: 180 }} placeholder="Type"
          options={defectTypesOf(r.category).map((t) => ({ value: t.id, label: t.name }))}
          onChange={(val) => setDefect(idx, 'defectTypeId', val)} />
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
  ], [setDefect, defectCategories, defectTypesOf]);

  const handleSave = async () => {
    if (!report.totalInspected) return message.warning('Enter the total pieces inspected');
    if (!report.lineId) return message.warning('Select the line');
    if (report.defects.some((d) => !d.defectTypeId)) return message.warning('Every defect row needs a type');
    setSaving(true);
    try {
      const saved = await saveTopse(report);
      message.success(`${saved.reportNo} saved — DHU ${saved.dhuPct}% (${saved.trafficLight})`);
      navigate('/production/sewing?tab=topse');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the report');
    } finally { setSaving(false); }
  };

  if (!report) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const lightMeta = TOPSE_TRAFFIC_META[totals.trafficLight];

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
              onChange={(v) => {
                selectOrder(orders.find((o) => o.id === v));
                patch({ orderId: v });
              }} />
          </div>
          <div>
            <FieldLabel>Line</FieldLabel>
            <FormSelect value={report.lineId} style={{ width: 130 }} options={lineOptions}
              onChange={(v) => patch({ lineId: v })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(report.reportDate)}
              onChange={(d) => patch({ reportDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Total Inspected</FieldLabel>
            <InputNumber min={0} value={report.totalInspected} style={{ width: 110 }} onChange={(v) => patch({ totalInspected: v })} />
          </div>
          <div>
            <FieldLabel>Inspector</FieldLabel>
            <FormSelect value={report.inspectorId} style={{ width: 200 }} placeholder="Select inspector"
              showSearch optionFilterProp="label" allowClear
              options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeNo})` }))}
              onChange={(v) => patch({ inspectorId: v ?? null })} />
          </div>
          <div>
            <FieldLabel>Traffic Light (GREEN ≤ {greenMax}% · RED &gt; {yellowMax}%)</FieldLabel>
            <Tag color={lightMeta.color} style={{ fontWeight: 700 }}>{totals.trafficLight} — {lightMeta.label}</Tag>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total Defects" value={totals.totalDefects} styles={{ content: { color: totals.totalDefects ? 'var(--error-color)' : undefined } }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Sent for Rework" value={totals.totalRework} styles={{ content: { color: totals.totalRework ? 'var(--warning-color)' : undefined } }} /></Card></Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic title="DHU %" value={totals.dhuPct} suffix="%"
              styles={{ content: { color: `var(--${totals.trafficLight === 'GREEN' ? 'success' : totals.trafficLight === 'YELLOW' ? 'warning' : 'error'}-color)` } }} />
          </Card>
        </Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Pass Rate %" value={totals.passRatePct} suffix="%" styles={{ content: { color: totals.passRatePct >= 95 ? 'var(--success-color)' : 'var(--warning-color)' } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={15}>
          <Card
            title="Defects Found (hour-wise)"
            extra={(
              <Button icon={<PlusOutlined />} size="small"
                onClick={() => patch({ defects: [...report.defects, { hour: 1, category: defectCategories[0], defectTypeId: null, count: 1, rework: 0 }] })}>
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
            {totals.pareto.length === 0
              ? <span style={{ color: 'var(--text-secondary)' }}>No defects logged yet</span>
              : totals.pareto.map((d) => (
                <div key={d.defectTypeId} style={{ marginBottom: 10 }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                    <span>{d.defectType} <Tag color={CATEGORY_COLORS[d.category]} style={{ marginInlineStart: 4 }}>{d.category?.replace(' Defects', '')}</Tag></span>
                    <strong>{d.count} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({d.sharePct}%)</span></strong>
                  </Space>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((d.count / totals.paretoMax) * 100)}%`, height: '100%', background: CATEGORY_COLORS[d.category] || 'var(--error-color)', borderRadius: 4 }} />
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
          <span>Defects <strong>{totals.totalDefects}</strong></span>
          <span>DHU <strong>{totals.dhuPct}%</strong></span>
          <span>Pass rate <strong>{totals.passRatePct}%</strong></span>
          <span>Rework <strong>{totals.totalRework}</strong></span>
          <span>Top defect <strong>{totals.pareto[0]?.defectType || '—'}</strong></span>
        </Space>
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Defects per hour</FieldLabel>
          <Space wrap>
            {totals.byHour.map((h) => (
              <Tag key={h.hour} color={h.peak ? 'red' : h.count ? 'orange' : 'default'}>
                {h.label}: {h.count}
              </Tag>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default TopseForm;
