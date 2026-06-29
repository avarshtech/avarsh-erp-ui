import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, DatePicker, Select, Space, Typography, Spin } from 'antd';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { formatDate, formatNumber, formatCurrency } from '../../../utils/formatters';
import { getAllowanceExceedGRNs } from '../../../services/inventory/inventoryService';
import AllowanceDocket from './AllowanceDocket';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

// Today's range — used as the initial filter value and as the fallback whenever
// a stray onChange(null) arrives (defensive: allowClear={false} plus a change
// guard means the range can never be emptied).
const todayRange = () => {
  const t = dayjs().startOf('day');
  return [t, t];
};

const AllowancePage = () => {
  const { message } = App.useApp();
  const [range, setRange] = useState(todayRange);
  const [loading, setLoading] = useState(false);
  const [rawGrns, setRawGrns] = useState([]);
  const [category, setCategory] = useState(undefined);
  const [supplier, setSupplier] = useState(undefined);

  const [startIso, endIso] = useMemo(
    () => [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')],
    [range],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllowanceExceedGRNs({ dateStart: startIso, dateEnd: endIso });
      setRawGrns(res);
    } catch {
      message.error('Failed to load GRN allowance exceptions');
      setRawGrns([]);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso, message]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRangeChange = useCallback((value) => {
    // Filter is locked — can never be blank. If either end is missing, snap back to today.
    if (!value || !value[0] || !value[1] || !value[0].isValid() || !value[1].isValid()) {
      setRange(todayRange());
      return;
    }
    setRange([value[0].startOf('day'), value[1].startOf('day')]);
  }, []);

  // Cross-scoped options: each filter narrows the other's option set so users
  // can't pick an empty pairing. Supplier options come from rawGrns filtered by
  // the current category; category options come from rawGrns filtered by the
  // current supplier. If a previously-selected value becomes invalid under the
  // new scope (e.g., category changed), we clear it via the effect below.
  const supplierOptions = useMemo(() => {
    const pool = category ? rawGrns.filter((g) => g.type === category) : rawGrns;
    const names = [...new Set(pool.map((g) => g.supplier).filter(Boolean))].sort();
    return names.map((s) => ({ label: s, value: s }));
  }, [rawGrns, category]);

  const categoryOptions = useMemo(() => {
    const pool = supplier ? rawGrns.filter((g) => g.supplier === supplier) : rawGrns;
    const types = [...new Set(pool.map((g) => g.type).filter(Boolean))].sort();
    return types.map((t) => ({ label: t, value: t }));
  }, [rawGrns, supplier]);

  // If the current selection becomes invalid under the counterpart filter (e.g.,
  // user picked Supplier X then picked Category Y that X never supplies), clear
  // the orphaned value so the visible list matches the visible options.
  useEffect(() => {
    if (supplier && !supplierOptions.some((o) => o.value === supplier)) setSupplier(undefined);
  }, [supplier, supplierOptions]);
  useEffect(() => {
    if (category && !categoryOptions.some((o) => o.value === category)) setCategory(undefined);
  }, [category, categoryOptions]);

  const grns = useMemo(() => {
    return rawGrns.filter((g) => {
      if (category && g.type !== category) return false;
      if (supplier && g.supplier !== supplier) return false;
      return true;
    });
  }, [rawGrns, category, supplier]);

  const summary = useMemo(() => {
    const lines = grns.flatMap((g) => g.offendingLines);
    const excessValue = lines.reduce((s, l) => s + (l.excessQty || 0) * (l.rate || 0), 0);
    const critical = lines.filter((l) => l.severity === 'high').length;
    return { grnCount: grns.length, lineCount: lines.length, excessValue, critical };
  }, [grns]);

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title="GRN Allowance Exceptions"
        subtitle="GRN line items where supplier over-supply exceeded the item's master allowance"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap align="end" size={16}>
          <FilterField label="GRN date range">
            <RangePicker
              value={range}
              onChange={handleRangeChange}
              allowClear={false}
              format="DD-MMM-YYYY"
              disabledDate={(d) => d && d.isAfter(dayjs().endOf('day'))}
              style={{ width: 280 }}
              inputReadOnly
            />
          </FilterField>
          <FilterField label="Category">
            <Select
              placeholder="All categories"
              allowClear
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              style={{ width: 170 }}
              disabled={categoryOptions.length === 0}
              notFoundContent="No categories in range"
            />
          </FilterField>
          <FilterField label="Supplier">
            <Select
              placeholder="All suppliers"
              allowClear
              showSearch
              value={supplier}
              onChange={setSupplier}
              options={supplierOptions}
              optionFilterProp="label"
              style={{ width: 240 }}
              disabled={supplierOptions.length === 0}
              notFoundContent="No suppliers in range"
            />
          </FilterField>
        </Space>
        <div style={{ borderTop: '1px dashed var(--border-color)', margin: '16px 0' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, width: '100%' }}>
          <SummaryStat label="GRNs flagged" value={formatNumber(summary.grnCount)} />
          <SummaryStat label="Lines over allowance" value={formatNumber(summary.lineCount)} />
          <SummaryStat label="Critical (≥ 2× allowance)" value={formatNumber(summary.critical)} accent="var(--error-color)" />
          <SummaryStat label="Total excess value" value={formatCurrency(summary.excessValue)} accent="var(--warning-color)" />
        </div>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>
      ) : grns.length === 0 ? (
        <Card>
          <EmptyState
            title="No over-allowance GRNs"
            description={
              category || supplier
                ? `No match for the current category/supplier filter between ${formatDate(startIso)} and ${formatDate(endIso)}.`
                : `No GRN between ${formatDate(startIso)} and ${formatDate(endIso)} has a line item exceeding its master allowance.`
            }
            showAction={false}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grns.map((grn) => (
            <AllowanceDocket key={grn.id} grn={grn} />
          ))}
        </div>
      )}
    </div>
  );
};

const FilterField = ({ label, children }) => (
  <div>
    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
      {label}
    </Text>
    {children}
  </div>
);

const SummaryStat = ({ label, value, accent }) => (
  <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', minWidth: 140 }}>
    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</Text>
    <Title level={4} style={{ margin: 0, color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</Title>
  </div>
);

export default AllowancePage;
