import { memo, useCallback, useMemo, useState } from 'react';
import { Button, Card, Col, Divider, Input, InputNumber, Row, Select, Statistic, Switch, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatCurrency } from '../../../utils/formatters';
import { TAX_TYPES } from '../../../utils/billPassingConstants';
import { computeBasic, computeTaxableValue, recalcBill, recalcTaxes } from '../../../utils/billPassingCalc';

const { Text } = Typography;

const tempId = () => `tmp-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
const money = (n) => formatCurrency(n, 'INR');
const readOnlyCell = (n) => (
  <CurrencyDisplay amount={n} currency="INR" strong={false} color="var(--text-secondary)" />
);

const summaryCardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  marginBottom: 16,
};

/** FR-BP-701/702 — the bill build-up, recalculated locally on every keystroke. */
function BpCalculationPanel({ bill, chargeTypes, readOnly, onChange }) {
  const [charges, setCharges] = useState(bill?.charges || []);
  const [taxes, setTaxes] = useState(bill?.taxes || []);
  const [adjustment, setAdjustment] = useState(Number(bill?.adjustmentTotal) || 0);

  // Re-seed whenever the orchestrator hands back a saved bill. Adjusting state
  // during render rather than in an effect avoids the extra commit that would
  // otherwise paint the totals with the previous bill's charges for one frame.
  const billKey = `${bill?.id ?? 'new'}:${bill?.version ?? 0}`;
  const [seededKey, setSeededKey] = useState(billKey);
  if (seededKey !== billKey) {
    setSeededKey(billKey);
    setCharges(bill?.charges || []);
    setTaxes(bill?.taxes || []);
    setAdjustment(Number(bill?.adjustmentTotal) || 0);
  }

  const working = useMemo(
    () => ({ ...bill, charges, taxes, adjustmentTotal: adjustment }),
    [bill, charges, taxes, adjustment],
  );
  const viewTaxes = useMemo(() => recalcTaxes(working), [working]);
  const totals = useMemo(() => recalcBill({ ...working, taxes: viewTaxes }), [working, viewTaxes]);
  const taxableValue = useMemo(() => computeTaxableValue(working), [working]);
  const basic = useMemo(() => computeBasic(bill), [bill]);

  /** One funnel for every edit: price the taxes, then hand the full arrays up. */
  const emit = useCallback((nextCharges, nextTaxes, nextAdjustment) => {
    setCharges(nextCharges);
    setTaxes(nextTaxes);
    setAdjustment(nextAdjustment);
    const priced = recalcTaxes({ ...bill, charges: nextCharges, taxes: nextTaxes });
    onChange?.({ charges: nextCharges, taxes: priced, adjustmentTotal: nextAdjustment });
  }, [bill, onChange]);

  const patchCharge = useCallback((id, patch) => {
    emit(charges.map((c) => (c.id === id ? { ...c, ...patch } : c)), taxes, adjustment);
  }, [charges, taxes, adjustment, emit]);

  const patchTax = useCallback((id, patch) => {
    emit(charges, taxes.map((t) => (t.id === id ? { ...t, ...patch } : t)), adjustment);
  }, [charges, taxes, adjustment, emit]);

  const addCharge = useCallback(() => {
    emit([...charges, { id: tempId(), chargeTypeCode: null, amount: 0, taxable: true, remarks: '' }], taxes, adjustment);
  }, [charges, taxes, adjustment, emit]);

  const addTax = useCallback(() => {
    emit(charges, [...taxes, { id: tempId(), taxType: null, ratePercent: 0, asPerInvoiceAmount: 0 }], adjustment);
  }, [charges, taxes, adjustment, emit]);

  const removeCharge = useCallback((id) => {
    emit(charges.filter((c) => c.id !== id), taxes, adjustment);
  }, [charges, taxes, adjustment, emit]);

  const removeTax = useCallback((id) => {
    emit(charges, taxes.filter((t) => t.id !== id), adjustment);
  }, [charges, taxes, adjustment, emit]);

  const chargeOptions = useMemo(
    () => (chargeTypes || []).filter((t) => t.active !== false).map((t) => ({ value: t.code, label: t.name })),
    [chargeTypes],
  );

  const chargeColumns = useMemo(() => [
    {
      title: 'Charge Type', dataIndex: 'chargeTypeCode', key: 'chargeTypeCode', width: 180,
      render: (v, r) => (
        <Select
          size="small" style={{ width: '100%' }} value={v || undefined} options={chargeOptions}
          placeholder="Select" disabled={readOnly} showSearch optionFilterProp="label"
          onChange={(code) => {
            const type = (chargeTypes || []).find((t) => t.code === code);
            patchCharge(r.id, { chargeTypeCode: code, taxable: type?.defaultTaxable ?? r.taxable });
          }}
        />
      ),
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', width: 140, align: 'right',
      render: (v, r) => (
        <InputNumber
          size="small" controls={false} {...numericInputProps} min={0} precision={2}
          style={{ width: '100%' }} value={v} disabled={readOnly}
          onChange={(n) => patchCharge(r.id, { amount: n })}
        />
      ),
    },
    {
      title: 'Taxable', dataIndex: 'taxable', key: 'taxable', width: 90, align: 'center',
      render: (v, r) => (
        <Switch size="small" checked={!!v} disabled={readOnly} onChange={(c) => patchCharge(r.id, { taxable: c })} />
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks',
      render: (v, r) => (
        <Input
          size="small" value={v || ''} disabled={readOnly} placeholder="Optional"
          onChange={(e) => patchCharge(r.id, { remarks: e.target.value })}
        />
      ),
    },
    {
      title: '', key: 'actions', width: 60, align: 'center',
      render: (_, r) => (
        <ActionButton action="delete" tooltip="Remove charge" disabled={readOnly} onClick={() => removeCharge(r.id)} />
      ),
    },
  ], [chargeOptions, chargeTypes, readOnly, patchCharge, removeCharge]);

  const taxColumns = useMemo(() => [
    {
      title: 'Tax Type', dataIndex: 'taxType', key: 'taxType', width: 130,
      render: (v, r) => (
        <Select
          size="small" style={{ width: '100%' }} value={v || undefined} placeholder="Select" disabled={readOnly}
          options={TAX_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={(t) => patchTax(r.id, { taxType: t })}
        />
      ),
    },
    {
      title: 'Rate %', dataIndex: 'ratePercent', key: 'ratePercent', width: 110, align: 'center',
      render: (v, r) => (
        <InputNumber
          size="small" controls={false} {...numericInputProps} min={0} max={100} precision={2}
          style={{ width: '100%' }} value={v} disabled={readOnly}
          onChange={(n) => patchTax(r.id, { ratePercent: n })}
        />
      ),
    },
    {
      title: 'Taxable Value', dataIndex: 'taxableValue', key: 'taxableValue', width: 140, align: 'right',
      render: () => readOnlyCell(taxableValue),
    },
    {
      title: 'Computed', dataIndex: 'computedAmount', key: 'computedAmount', width: 140, align: 'right',
      render: (v) => readOnlyCell(v),
    },
    {
      title: 'As per Invoice', dataIndex: 'asPerInvoiceAmount', key: 'asPerInvoiceAmount', width: 150, align: 'right',
      render: (v, r) => (
        <InputNumber
          size="small" controls={false} {...numericInputProps} min={0} precision={2}
          style={{ width: '100%' }} value={v} disabled={readOnly}
          onChange={(n) => patchTax(r.id, { asPerInvoiceAmount: n })}
        />
      ),
    },
    {
      title: 'Variance', dataIndex: 'variance', key: 'variance', width: 130, align: 'right',
      render: (v) => (
        <CurrencyDisplay
          amount={v}
          currency="INR"
          strong={!!v}
          color={v ? 'var(--error-color)' : 'var(--text-secondary)'}
        />
      ),
    },
    {
      title: '', key: 'actions', width: 60, align: 'center',
      render: (_, r) => (
        <ActionButton action="delete" tooltip="Remove tax line" disabled={readOnly} onClick={() => removeTax(r.id)} />
      ),
    },
  ], [readOnly, taxableValue, patchTax, removeTax]);

  const netColor = bill?.blockers?.length ? 'var(--error-color)' : 'var(--success-color)';

  return (
    <>
      <Card style={summaryCardStyle}>
        <Row gutter={[24, 16]}>
          <Col xs={12} md={6}>
            <Statistic title="Gross Invoice Amount" value={money(basic)} valueStyle={{ fontSize: 16 }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="+ Applicable Charges" value={money(totals.chargesTotal)} valueStyle={{ fontSize: 16, color: 'var(--primary-color)' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="+ GST / Taxes" value={money(totals.taxTotal)} valueStyle={{ fontSize: 16, color: 'var(--primary-color)' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="- Debits (Confirmed)" value={money(totals.debitTotal)} valueStyle={{ fontSize: 16, color: 'var(--warning-color)' }} />
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>- Other Adjustments</Text>
            </div>
            <InputNumber
              controls={false} {...numericInputProps} precision={2} style={{ width: '100%' }}
              value={adjustment} disabled={readOnly} placeholder="0.00"
              onChange={(n) => emit(charges, taxes, Number(n) || 0)}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Basic + Charges + Taxes (as per invoice) - Confirmed Debits - Adjustments
            </Text>
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="NET PAYABLE"
              value={money(totals.netPayable)}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: netColor }}
            />
          </Col>
        </Row>
      </Card>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Applicable Charges</Text>
      <Table
        rowKey="id" size="small" bordered pagination={false} scroll={{ x: 700 }}
        columns={chargeColumns} dataSource={charges}
        locale={{ emptyText: <EmptyState title="No charges" description="Add freight, insurance or packing charged on this invoice." /> }}
      />
      <Button type="dashed" block icon={<PlusOutlined />} disabled={readOnly} onClick={addCharge} style={{ margin: '8px 0 20px' }}>
        Add charge
      </Button>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>GST / Taxes</Text>
      <Table
        rowKey="id" size="small" bordered pagination={false} scroll={{ x: 900 }}
        columns={taxColumns} dataSource={viewTaxes}
        locale={{ emptyText: <EmptyState title="No tax lines" description="Add a CGST/SGST or IGST line to match the supplier invoice." /> }}
      />
      <Text style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>
        The As per Invoice figure is what reaches Net Payable; Computed is what the PO tax rate implies on the taxable value.
      </Text>
      <Button type="dashed" block icon={<PlusOutlined />} disabled={readOnly} onClick={addTax}>
        Add tax line
      </Button>
    </>
  );
}

export default memo(BpCalculationPanel);
