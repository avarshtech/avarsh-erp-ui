import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Row, Col, InputNumber, Button, Space, Divider, Spin, App } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import EmptyState from '../../components/EmptyState';
import PermissionGuard from '../../components/PermissionGuard';
import { numericInputProps, integerInputProps } from '../../utils/inputHelpers';
import { getTolerance, saveTolerance } from '../../services/inventory/billPassingService';
import { BP_MODULE_ID, DEFAULT_TOLERANCE } from '../../utils/billPassingConstants';
import { hasPermission } from '../../utils/permissions';

const BpToleranceSettings = ({ onDirtyChange }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form] = Form.useForm();
  const savedValues = useRef(DEFAULT_TOLERANCE);
  const skipDirty = useRef(false);

  const canUpdate = hasPermission(BP_MODULE_ID, 'update');

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const applyValues = useCallback((values) => {
    skipDirty.current = true;
    savedValues.current = values;
    form.setFieldsValue(values);
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [form, markDirty]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const values = await getTolerance();
      applyValues({ ...DEFAULT_TOLERANCE, ...values });
    } catch (e) {
      setLoadError(e.message || 'Failed to load tolerance settings');
    } finally {
      setLoading(false);
    }
  }, [applyValues]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = useCallback(async (values) => {
    if (!canUpdate) { message.warning('You do not have permission to change tolerance settings'); return; }
    setSaving(true);
    try {
      const saved = await saveTolerance(values);
      applyValues({ ...DEFAULT_TOLERANCE, ...saved });
      message.success('Tolerance settings saved');
    } catch (e) {
      message.error(e.message || 'Failed to save tolerance settings');
    } finally {
      setSaving(false);
    }
  }, [canUpdate, applyValues, message]);

  const handleReset = useCallback(() => {
    applyValues(savedValues.current);
  }, [applyValues]);

  const numberCol = (name, label, extra, props) => (
    <Col xs={24} sm={12} lg={8}>
      <Form.Item
        name={name}
        label={label}
        extra={extra}
        rules={[{ required: true, message: `Please enter ${label.toLowerCase()}` }]}
      >
        <InputNumber min={0} style={{ width: '100%' }} {...props} />
      </Form.Item>
    </Col>
  );

  if (loadError) {
    return (
      <div className="animate-fade-in-up">
        <Card>
          <EmptyState
            title="Tolerance settings unavailable"
            description={loadError}
            actionLabel="Retry"
            onAction={loadData}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <Card
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Tolerance Settings</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
              Bill Passing — the limits that decide when a variance is flagged
            </div>
          </div>
        }
        extra={
          <Space>
            <Button icon={<UndoOutlined />} onClick={handleReset} disabled={!unsavedChanges || saving}>
              Reset
            </Button>
            <PermissionGuard module={BP_MODULE_ID} operation="update">
              <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving} disabled={!unsavedChanges}>
                Save
              </Button>
            </PermissionGuard>
          </Space>
        }
      >
        <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={!canUpdate}
          initialValues={DEFAULT_TOLERANCE}
          onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
        >
          <Divider titlePlacement="start" style={{ marginTop: 0, color: 'var(--text-secondary)' }}>Invoice vs GRN matching</Divider>
          <Row gutter={24}>
            {numberCol('qtyPercent', 'Quantity Tolerance %', 'How far the invoiced quantity may drift from the QC-accepted quantity before the reconciliation row turns red.', { ...numericInputProps, max: 100, step: 0.1, precision: 2 })}
            {numberCol('ratePercent', 'Rate Tolerance %', 'Allowed gap between the invoice rate and the PO rate. Zero means any rate difference is flagged.', { ...numericInputProps, max: 100, step: 0.1, precision: 2 })}
            {numberCol('valueAmount', 'Value Tolerance (₹)', 'Absolute rupee difference forgiven on the invoice value, so rounding on large bills is not reported as a mismatch.', { ...numericInputProps, step: 10, precision: 2 })}
          </Row>

          <Divider titlePlacement="start" style={{ color: 'var(--text-secondary)' }}>Tax and invoice checks</Divider>
          <Row gutter={24}>
            {numberCol('taxVarianceAmount', 'Tax Variance (₹)', 'Gap allowed between the tax computed by the system and the tax printed on the supplier invoice.', { ...numericInputProps, step: 1, precision: 2 })}
            {numberCol('invoiceAgeDays', 'Invoice Age Limit (days)', 'An invoice older than this raises an exception — stale invoices usually mean a missed GRN or a duplicate entry.', { ...integerInputProps, max: 3650, step: 1, precision: 0 })}
          </Row>

          <Divider titlePlacement="start" style={{ color: 'var(--text-secondary)' }}>Approval and escalation</Divider>
          <Row gutter={24}>
            {numberCol('debitPercentThreshold', 'Debit Threshold % (co-approval)', 'When total debits cross this share of the invoice, the bill needs a second approver before it can be passed.', { ...numericInputProps, max: 100, step: 0.5, precision: 2 })}
            {numberCol('holdEscalationDays', 'Hold Escalation (days)', 'A bill sitting on hold longer than this is escalated on the list so it stops ageing quietly.', { ...integerInputProps, max: 365, step: 1, precision: 0 })}
          </Row>
        </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default BpToleranceSettings;
