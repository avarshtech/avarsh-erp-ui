import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, DatePicker, Button, Table, InputNumber,
  Spin, Descriptions, Tag, Space, Statistic,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  searchSewingPlans, searchHourlyProduction, getHourlyProductionById,
  createHourlyProduction, updateHourlyEntries,
} from '../../../services/sewing/sewingService';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import {
  SHIFT_OPTIONS, EFFICIENCY_THRESHOLDS,
  getHourlyStatusLabel, getHourlyStatusColor,
} from '../../../utils/sewingConstants';
import { formatNumber, formatPercentage } from '../../../utils/formatters';

// Map to actual API field names: hour1, hour2, ..., hour8, ot
const HOUR_FIELDS = ['hour1', 'hour2', 'hour3', 'hour4', 'hour5', 'hour6', 'hour7', 'hour8'];
const OT_FIELD = 'ot';

const HourlyProductionPage = () => {
  const { message } = App.useApp();
  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedShift, setSelectedShift] = useState('DAY');

  const [recordId, setRecordId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);

  // Load all active plans on mount
  const loadPlans = useCallback(async (search) => {
    setPlanSearching(true);
    try {
      const params = { page: 0, size: 50 };
      if (search && search.length >= 2) params.search = search;
      const res = await searchSewingPlans(params);
      const opts = (res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo || ''} — ${p.styleNo || ''} — ${p.buyerName || ''} — ${p.color || ''}`,
        plan: p,
      }));
      setPlanOptions(opts);
      // Auto-select if only one plan and nothing selected
      if (opts.length === 1 && !selectedPlanId) {
        setSelectedPlanId(opts[0].value);
        setSelectedPlan(opts[0].plan);
      }
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, [selectedPlanId]);

  // Auto-load plans on mount
  useEffect(() => { loadPlans(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlanSearch = useCallback((search) => { loadPlans(search); }, [loadPlans]);

  const handlePlanSelect = useCallback((_value, option) => {
    setSelectedPlanId(option.value);
    setSelectedPlan(option.plan);
  }, []);

  // Load or create hourly production record when plan+date+shift changes
  const loadHourlyData = useCallback(async () => {
    if (!selectedPlanId || !selectedDate || !selectedShift) return;
    setLoading(true);
    try {
      const date = selectedDate.format('YYYY-MM-DD');
      const res = await searchHourlyProduction({
        planId: selectedPlanId,
        dateStart: date,
        dateEnd: date,
        page: 0,
        size: 1,
      });

      if (res.content && res.content.length > 0) {
        // Search returns header only — fetch full record with entries
        const fullRecord = await getHourlyProductionById(res.content[0].id);
        setRecordId(fullRecord.id);
        setStatus(fullRecord.status);
        setEntries(fullRecord.entries || []);
      } else {
        // Auto-create new record
        try {
          const created = await createHourlyProduction({
            planId: selectedPlanId,
            lineId: selectedPlan?.lineId,
            productionDate: date,
            shift: selectedShift,
            orderQty: selectedPlan?.totalOrderQty || 0,
            targetOutput: selectedPlan?.targetPerDay || 0,
          });
          setRecordId(created.id);
          setStatus(created.status);
          setEntries(created.entries || []);
        } catch (err) {
          // If 409 (already exists), try loading again
          if (err?.response?.status === 409) {
            const retry = await searchHourlyProduction({
              planId: selectedPlanId,
              dateStart: date,
              dateEnd: date,
              page: 0,
              size: 1,
            });
            if (retry.content && retry.content.length > 0) {
              const record = retry.content[0];
              setRecordId(record.id);
              setStatus(record.status);
              setEntries(record.entries || []);
            }
          } else {
            throw err;
          }
        }
      }
    } catch {
      message.error('Failed to load hourly production data');
      setRecordId(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, selectedDate, selectedShift]);

  useEffect(() => {
    if (selectedPlanId && selectedDate && selectedShift) {
      loadHourlyData();
    }
  }, [selectedPlanId, selectedDate, selectedShift]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update entry value (direct field update: hour1, hour2, ..., ot)
  const updateEntry = useCallback((operatorIndex, field, value) => {
    setEntries((prev) => prev.map((entry, i) => {
      if (i !== operatorIndex) return entry;
      return { ...entry, [field]: value };
    }));
  }, []);

  // Calculate totals from flat fields (hour1..hour8 + ot)
  const totals = useMemo(() => {
    const colTotals = {};
    HOUR_FIELDS.forEach((h) => { colTotals[h] = 0; });
    colTotals[OT_FIELD] = 0;
    let grandTotal = 0;

    entries.forEach((entry) => {
      HOUR_FIELDS.forEach((h) => {
        colTotals[h] += entry[h] || 0;
      });
      colTotals[OT_FIELD] += entry[OT_FIELD] || 0;
    });

    Object.values(colTotals).forEach((v) => { grandTotal += v; });
    return { colTotals, grandTotal };
  }, [entries]);

  const rowTotals = useMemo(() => {
    return entries.map((entry) => {
      let total = 0;
      HOUR_FIELDS.forEach((h) => { total += entry[h] || 0; });
      total += entry[OT_FIELD] || 0;
      return total;
    });
  }, [entries]);

  // Target & efficiency
  const targetPerDay = selectedPlan?.targetPerDay || 0;
  const actualTotal = totals.grandTotal;
  const efficiencyPct = targetPerDay > 0 ? (actualTotal / targetPerDay) * 100 : 0;

  const efficiencyColor = useMemo(() => {
    if (efficiencyPct >= EFFICIENCY_THRESHOLDS.GREEN) return '#52c41a';
    if (efficiencyPct >= EFFICIENCY_THRESHOLDS.YELLOW) return '#faad14';
    return '#ff4d4f';
  }, [efficiencyPct]);

  // Save all entries
  const handleSave = useCallback(async () => {
    if (!recordId) return;
    setSaving(true);
    try {
      await updateHourlyEntries(recordId, entries.map((entry) => ({
        id: entry.id,
        operatorId: entry.operatorId,
        operatorName: entry.operatorName,
        partsName: entry.partsName,
        operationName: entry.operationName,
        machineType: entry.machineType,
        samTarget: entry.samTarget,
        hour1: entry.hour1 || 0,
        hour2: entry.hour2 || 0,
        hour3: entry.hour3 || 0,
        hour4: entry.hour4 || 0,
        hour5: entry.hour5 || 0,
        hour6: entry.hour6 || 0,
        hour7: entry.hour7 || 0,
        hour8: entry.hour8 || 0,
        ot: entry.ot || 0,
      })));
      message.success('Hourly production saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [recordId, entries]);

  // Build table columns — industry standard: Operator | Operation | Machine | SAM | Hr1-8 | OT | Total | Target | Eff%
  const columns = useMemo(() => {
    const cols = [
      {
        title: 'Operator',
        dataIndex: 'operatorName',
        key: 'operatorName',
        width: 140,
        fixed: 'left',
        ellipsis: true,
        render: (name) => name || 'Unknown',
      },
      {
        title: 'Operation',
        dataIndex: 'operationName',
        key: 'operationName',
        width: 130,
        ellipsis: true,
        render: (v) => v || '-',
      },
      {
        title: 'Machine',
        dataIndex: 'machineType',
        key: 'machineType',
        width: 80,
        render: (v) => <span style={{ fontSize: 11 }}>{v || '-'}</span>,
      },
      {
        title: 'SAM',
        dataIndex: 'samTarget',
        key: 'samTarget',
        width: 60,
        align: 'right',
        render: (v) => v ? Number(v).toFixed(2) : '-',
      },
    ];

    HOUR_FIELDS.forEach((field, idx) => {
      cols.push({
        title: `Hr ${idx + 1}`,
        key: field,
        width: 80,
        align: 'center',
        render: (_, _record, rowIndex) => (
          <InputNumber
            size="small"
            min={0}
            value={entries[rowIndex]?.[field] || 0}
            onChange={(v) => updateEntry(rowIndex, field, v || 0)}
            style={{ width: '100%' }}
            controls={false}
          />
        ),
      });
    });

    cols.push({
      title: 'OT',
      key: OT_FIELD,
      width: 80,
      align: 'center',
      render: (_, _record, rowIndex) => (
        <InputNumber
          size="small"
          min={0}
          value={entries[rowIndex]?.[OT_FIELD] || 0}
          onChange={(v) => updateEntry(rowIndex, OT_FIELD, v || 0)}
          style={{ width: '100%' }}
          controls={false}
        />
      ),
    });

    cols.push({
      title: 'Total',
      key: 'total',
      width: 70,
      align: 'right',
      render: (_, __, rowIndex) => (
        <strong>{formatNumber(rowTotals[rowIndex] || 0)}</strong>
      ),
    });

    cols.push({
      title: 'Tgt/Day',
      key: 'targetPerDay',
      width: 70,
      align: 'right',
      render: (_, record) => {
        const sam = record.samTarget ? Number(record.samTarget) : 0;
        if (sam <= 0) return '-';
        const targetPerHour = Math.floor(60 / sam);
        const targetPerDay = targetPerHour * 8;
        return <span style={{ color: '#888' }}>{targetPerDay}</span>;
      },
    });

    cols.push({
      title: 'Eff %',
      key: 'efficiency',
      width: 75,
      align: 'right',
      fixed: 'right',
      render: (_, record, rowIndex) => {
        const sam = record.samTarget ? Number(record.samTarget) : 0;
        const total = rowTotals[rowIndex] || 0;
        if (sam <= 0 || total <= 0) return <span style={{ color: '#ccc' }}>-</span>;
        const targetPerDay = Math.floor(60 / sam) * 8;
        const eff = targetPerDay > 0 ? (total / targetPerDay) * 100 : 0;
        const color = eff >= 100 ? '#52c41a' : eff >= 80 ? '#faad14' : '#ff4d4f';
        return <strong style={{ color }}>{eff.toFixed(0)}%</strong>;
      },
    });

    return cols;
  }, [entries, rowTotals, updateEntry]);

  const hasData = selectedPlanId && entries.length > 0;

  return (
    <>
      <PageHeader title="Hourly Production Entry" />

      {/* Selection bar */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Sewing Plan</label>
            <Select
              showSearch
              filterOption={false}
              onSearch={handlePlanSearch}
              onSelect={handlePlanSelect}
              loading={planSearching}
              options={planOptions}
              placeholder="Search approved plans..."
              style={{ width: '100%' }}
              value={selectedPlanId}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date</label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Shift</label>
            <Select
              value={selectedShift}
              onChange={setSelectedShift}
              options={SHIFT_OPTIONS}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6} md={4} style={{ paddingTop: 22 }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadHourlyData} disabled={!selectedPlanId}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Plan info header */}
      {selectedPlan && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
            <Descriptions.Item label="Plan No">{selectedPlan.planNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Style">{selectedPlan.styleNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{selectedPlan.buyerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Line">{selectedPlan.lineName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Order Qty">{formatNumber(selectedPlan.orderQty)}</Descriptions.Item>
            <Descriptions.Item label="Target/Day">{formatNumber(selectedPlan.targetPerDay)}</Descriptions.Item>
            <Descriptions.Item label="SAM">{selectedPlan.samPerPiece?.toFixed(2) || '-'}</Descriptions.Item>
            {status && (
              <Descriptions.Item label="Status">
                <Tag color={getHourlyStatusColor(status)}>{getHourlyStatusLabel(status)}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Hourly grid */}
      <Spin spinning={loading}>
        {hasData ? (
          <Card style={{ marginBottom: 80 }}>
            <Table
              rowKey={(_, index) => index}
              columns={columns}
              dataSource={entries}
              pagination={false}
              size="small"
              scroll={{ x: 1500 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} fixed="left"><strong>Total</strong></Table.Summary.Cell>
                    {HOUR_FIELDS.map((h, idx) => (
                      <Table.Summary.Cell key={h} index={idx + 1} align="center">
                        <strong>{formatNumber(totals.colTotals[h])}</strong>
                      </Table.Summary.Cell>
                    ))}
                    <Table.Summary.Cell index={HOUR_FIELDS.length + 1} align="center">
                      <strong>{formatNumber(totals.colTotals[OT_FIELD])}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={HOUR_FIELDS.length + 2} align="right" fixed="right">
                      <strong>{formatNumber(totals.grandTotal)}</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        ) : (
          !loading && selectedPlanId && (
            <Card>
              <EmptyState description="No entries found. Select a plan with operators to start entry." />
            </Card>
          )
        )}

        {!selectedPlanId && !loading && (
          <Card>
            <EmptyState description="Select a sewing plan, date, and shift to begin hourly production entry." />
          </Card>
        )}
      </Spin>

      {/* Sticky bottom bar */}
      {hasData && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          padding: '12px 24px',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}>
          <Space size="large">
            <Statistic
              title="Target"
              value={targetPerDay}
              valueStyle={{ fontSize: 20 }}
            />
            <Statistic
              title="Actual"
              value={actualTotal}
              valueStyle={{ fontSize: 20 }}
            />
            <Statistic
              title="Efficiency"
              value={efficiencyPct.toFixed(1)}
              suffix="%"
              valueStyle={{ fontSize: 28, fontWeight: 700, color: efficiencyColor }}
            />
          </Space>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            Save All Entries
          </Button>
        </div>
      )}
    </>
  );
};

export default HourlyProductionPage;
