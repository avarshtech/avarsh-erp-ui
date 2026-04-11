import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, DatePicker, Button, Table, InputNumber,
  Spin, Descriptions, Tag, Space, Statistic,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  searchSewingPlans, searchHourlyProduction,
  createHourlyProduction, updateHourlyEntries,
} from '../../../services/sewing/sewingService';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import {
  SHIFT_OPTIONS, EFFICIENCY_THRESHOLDS,
  getHourlyStatusLabel, getHourlyStatusColor,
} from '../../../utils/sewingConstants';
import { formatNumber, formatPercentage } from '../../../utils/formatters';

const HOUR_COLUMNS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'];
const OT_COLUMN = 'OT';

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

  // Search sewing plans
  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchSewingPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo || ''} — ${p.styleNo || ''} — ${p.lineName || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

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
        sewingPlanId: selectedPlanId,
        productionDate: date,
        shift: selectedShift,
        page: 0,
        size: 1,
      });

      if (res.content && res.content.length > 0) {
        const record = res.content[0];
        setRecordId(record.id);
        setStatus(record.status);
        setEntries(record.entries || []);
      } else {
        // Auto-create new record
        try {
          const created = await createHourlyProduction({
            sewingPlanId: selectedPlanId,
            productionDate: date,
            shift: selectedShift,
          });
          setRecordId(created.id);
          setStatus(created.status);
          setEntries(created.entries || []);
        } catch (err) {
          // If 409 (already exists), try loading again
          if (err?.response?.status === 409) {
            const retry = await searchHourlyProduction({
              sewingPlanId: selectedPlanId,
              productionDate: date,
              shift: selectedShift,
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

  // Update entry value
  const updateEntry = useCallback((operatorIndex, hour, value) => {
    setEntries((prev) => prev.map((entry, i) => {
      if (i !== operatorIndex) return entry;
      const hourlyData = { ...(entry.hourlyData || {}) };
      hourlyData[hour] = value;
      return { ...entry, hourlyData };
    }));
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const colTotals = {};
    HOUR_COLUMNS.forEach((h) => { colTotals[h] = 0; });
    colTotals[OT_COLUMN] = 0;
    let grandTotal = 0;

    entries.forEach((entry) => {
      const data = entry.hourlyData || {};
      HOUR_COLUMNS.forEach((h) => {
        const v = data[h] || 0;
        colTotals[h] += v;
      });
      const ot = data[OT_COLUMN] || 0;
      colTotals[OT_COLUMN] += ot;
    });

    Object.values(colTotals).forEach((v) => { grandTotal += v; });
    return { colTotals, grandTotal };
  }, [entries]);

  const rowTotals = useMemo(() => {
    return entries.map((entry) => {
      const data = entry.hourlyData || {};
      let total = 0;
      HOUR_COLUMNS.forEach((h) => { total += data[h] || 0; });
      total += data[OT_COLUMN] || 0;
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
      await updateHourlyEntries(recordId, {
        entries: entries.map((entry) => ({
          id: entry.id,
          operatorId: entry.operatorId,
          operatorName: entry.operatorName,
          hourlyData: entry.hourlyData || {},
        })),
      });
      message.success('Hourly production saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [recordId, entries]);

  // Build table columns
  const columns = useMemo(() => {
    const cols = [
      {
        title: 'Operator',
        dataIndex: 'operatorName',
        key: 'operatorName',
        width: 180,
        fixed: 'left',
        render: (name, record) => (
          <span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>
              {record.empCode || ''}
            </span>
            {record.empCode ? ' ' : ''}
            {name || 'Unknown'}
          </span>
        ),
      },
    ];

    HOUR_COLUMNS.forEach((h, idx) => {
      cols.push({
        title: `Hr ${idx + 1}`,
        key: h,
        width: 80,
        align: 'center',
        render: (_, _record, rowIndex) => (
          <InputNumber
            size="small"
            min={0}
            value={entries[rowIndex]?.hourlyData?.[h] || 0}
            onChange={(v) => updateEntry(rowIndex, h, v || 0)}
            style={{ width: '100%' }}
            controls={false}
          />
        ),
      });
    });

    cols.push({
      title: 'OT',
      key: OT_COLUMN,
      width: 80,
      align: 'center',
      render: (_, _record, rowIndex) => (
        <InputNumber
          size="small"
          min={0}
          value={entries[rowIndex]?.hourlyData?.[OT_COLUMN] || 0}
          onChange={(v) => updateEntry(rowIndex, OT_COLUMN, v || 0)}
          style={{ width: '100%' }}
          controls={false}
        />
      ),
    });

    cols.push({
      title: 'Total',
      key: 'total',
      width: 80,
      align: 'right',
      fixed: 'right',
      render: (_, __, rowIndex) => (
        <strong>{formatNumber(rowTotals[rowIndex] || 0)}</strong>
      ),
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
              scroll={{ x: 1100 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} fixed="left"><strong>Total</strong></Table.Summary.Cell>
                    {HOUR_COLUMNS.map((h, idx) => (
                      <Table.Summary.Cell key={h} index={idx + 1} align="center">
                        <strong>{formatNumber(totals.colTotals[h])}</strong>
                      </Table.Summary.Cell>
                    ))}
                    <Table.Summary.Cell index={HOUR_COLUMNS.length + 1} align="center">
                      <strong>{formatNumber(totals.colTotals[OT_COLUMN])}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={HOUR_COLUMNS.length + 2} align="right" fixed="right">
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
