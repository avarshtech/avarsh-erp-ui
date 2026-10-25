import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Select, Space, Tag } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MasterSplitView from '../../../components/MasterSplitView';
import DateInput from '../../../components/DateInput';
import PermissionGuard from '../../../components/PermissionGuard';
import { hasPermission } from '../../../utils/permissions';
import './statutoryRateMaster.css';
import {
  getAllStatutoryRates, createStatutoryRate, updateStatutoryRate, deleteStatutoryRate,
} from '../../../services/hr/statutoryRateService';

const MODULE_ID = 'hr-masters';

/**
 * The figures payroll runs on, and the month each starts applying.
 *
 * <p>These rows have always been effective-dated, and payroll has always read the one
 * in effect for the month it is running. What was missing was any way to write one: the
 * PF wage ceiling was changed by connecting to the database. A ceiling moves when a
 * government says so, usually with notice, and the person who knows that is not the
 * person with psql.</p>
 *
 * <p>Effective dating is the whole point of the screen. Entering November's ceiling in
 * October does not disturb October's payroll, and reprinting an August payslip next year
 * still shows the figure August was actually paid on.</p>
 */
const CODES = [
  'PF_RATE', 'PF_WAGE_CEILING', 'EPS_RATE', 'EPS_WAGE_CEILING',
  'ESI_EMPLOYEE_RATE', 'ESI_EMPLOYER_RATE', 'ESI_GROSS_CEILING',
  'BONUS_MIN_PCT', 'BONUS_MAX_PCT', 'BONUS_ELIGIBILITY_CEILING',
  'BONUS_CALC_CEILING', 'BONUS_MIN_WORKING_DAYS',
  'GRATUITY_MIN_YEARS', 'GRATUITY_DAYS_FACTOR', 'GRATUITY_CEILING',
  'WAGE_DAYS_BASIS',
];

/** A rate is stored as a fraction, so 0.12 is shown and typed as 12%. */
const asPercent = (v) => (v == null ? null : Number((Number(v) * 100).toFixed(4)));
const fromPercent = (v) => (v == null ? null : Number((Number(v) / 100).toFixed(6)));

const showValue = (row) => {
  if (row.value == null) return '-';
  const n = Number(row.value);
  if (row.unit === 'PERCENT') return `${asPercent(n)}%`;
  if (row.unit === 'RUPEES') return `₹${n.toLocaleString('en-IN')}`;
  if (row.unit === 'DAYS') return `${n} days`;
  if (row.unit === 'YEARS') return `${n} years`;
  return String(n);
};

const StatutoryRateMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const isReadOnly = Boolean(selected) && !canUpdate;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllStatutoryRates();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      // axiosInstance already toasts the server's message.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Two columns, not four. The list lives in a third of the width when a figure is
  // open, and four columns forced a horizontal scrollbar - so the value, the one
  // thing somebody is looking for, was off the edge.
  const columns = [
    {
      title: 'Figure',
      dataIndex: 'label',
      // The stored code is PF_WAGE_CEILING, which says nothing about what it does.
      render: (v, r) => (
        <>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {r.code}{r.stateCode ? ` · ${r.stateCode}` : ''}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
            {r.effectiveFrom ? `From ${dayjs(r.effectiveFrom).format('DD-MMM-YYYY')}` : ''}
            {r.effectiveTo ? ` to ${dayjs(r.effectiveTo).format('DD-MMM-YYYY')}` : ''}
          </div>
        </>
      ),
    },
    {
      title: 'Value',
      key: 'value',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{showValue(r)}</div>
          {r.current
            ? <Tag color="green" style={{ marginInlineEnd: 0, marginTop: 4 }}>In effect</Tag>
            : <Tag style={{ marginInlineEnd: 0, marginTop: 4, opacity: 0.6 }}>Superseded</Tag>}
        </>
      ),
    },
  ];

  const fillForm = useCallback((record) => {
    skipDirty.current = true;
    form.setFieldsValue({
      ...record,
      value: record.unit === 'PERCENT' ? asPercent(record.value) : record.value,
      effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : null,
      effectiveTo: record.effectiveTo ? dayjs(record.effectiveTo) : null,
    });
    skipDirty.current = false;
  }, [form]);

  const handleSelect = useCallback((record) => {
    const open = () => { setSelected(record); setIsEditing(true); fillForm(record); markDirty(false); };
    if (unsavedChanges) {
      modal.confirm({ title: 'Unsaved changes', content: 'Discard changes?', onOk: open });
      return;
    }
    open();
  }, [fillForm, modal, unsavedChanges, markDirty]);

  const handleAdd = useCallback(() => {
    setSelected(null);
    setIsEditing(true);
    skipDirty.current = true;
    form.resetFields();
    skipDirty.current = false;
  }, [form]);

  const handleClose = useCallback(() => {
    setIsEditing(false);
    setSelected(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  /** What the number means for a code not yet saved, so the form can label it. */
  const unitOf = useCallback((code) => data.find((r) => r.code === code)?.unit ?? null, [data]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const unit = selected?.unit ?? unitOf(values.code);
      const payload = {
        ...values,
        value: unit === 'PERCENT' ? fromPercent(values.value) : values.value,
        effectiveFrom: values.effectiveFrom?.format('YYYY-MM-DD'),
        effectiveTo: values.effectiveTo ? values.effectiveTo.format('YYYY-MM-DD') : null,
      };
      if (selected) {
        await updateStatutoryRate(selected.id, payload);
        message.success('Figure updated');
      } else {
        await createStatutoryRate(payload);
        message.success('Figure saved — it applies from the month you set');
      }
      handleClose();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message.
    } finally {
      setSubmitting(false);
    }
  }, [form, selected, unitOf, message, handleClose, fetchData]);

  const handleDelete = useCallback(() => {
    if (!selected) return;
    modal.confirm({
      title: `Remove this ${selected.label}?`,
      content: 'Payroll will fall back to whichever figure applies before it.',
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteStatutoryRate(selected.id);
          message.success('Figure removed');
          handleClose();
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message.
        }
      },
    });
  }, [selected, modal, message, handleClose, fetchData]);

  const chosenCode = Form.useWatch('code', form);
  const unit = selected?.unit ?? unitOf(chosenCode);

  const renderForm = () => (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
      disabled={isReadOnly}
      className="statutory-form"
    >
      {/* Says which figure is open and how to leave, without scrolling. The select
          below is disabled on an existing row, so it reads as a greyed-out box
          rather than as a heading. */}
      <div className="statutory-form-head">
        <div>
          <div className="statutory-form-title">{selected ? selected.label : 'New figure'}</div>
          <div className="statutory-form-sub">
            {selected ? selected.code : 'Pick a figure and say which month it starts applying'}
          </div>
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={handleClose} aria-label="Close" />
      </div>

      <div className="statutory-form-body">
      {/* Only when adding. On an existing row the rule has already been applied and
          a paragraph of it above every field is in the way. */}
      {!selected && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="A figure is never overwritten"
          description="Saving a new one closes the one before it the day before this starts, so months
            already run keep the figure they were paid on."
        />
      )}
      {selected && (
        <Alert
          type={selected.current ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          title={selected.current
            ? 'This is the figure payroll is using now'
            : 'This figure is not the one in use today'}
        />
      )}

      <Form.Item name="code" label="Figure" rules={[{ required: true, message: 'Pick the figure' }]}>
        {/* The code cannot move once saved: every payroll already run against this row
            was computed on it, and changing it would rewrite what people were paid. */}
        <Select
          showSearch
          disabled={!!selected}
          placeholder="e.g. PF_WAGE_CEILING"
          options={CODES.map((c) => ({ value: c, label: c }))}
        />
      </Form.Item>

      <Form.Item
        name="value"
        label={unit === 'PERCENT' ? 'Value (%)' : unit === 'RUPEES' ? 'Value (₹)' : 'Value'}
        rules={[{ required: true, message: 'Enter the figure' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          prefix={unit === 'RUPEES' ? '₹' : undefined}
          suffix={unit === 'PERCENT' ? '%' : undefined}
        />
      </Form.Item>

      <Form.Item
        name="effectiveFrom"
        label="Applies from"
        extra="The first day of the month it starts applying to, e.g. 01-Nov-2026."
        rules={[{ required: true, message: 'Say when it starts' }]}
      >
        <DateInput style={{ width: '100%' }} disabled={!!selected} />
      </Form.Item>

      <Form.Item
        name="effectiveTo"
        label="Until"
        extra="Leave empty while it still applies. Entering the next figure closes this one for you."
      >
        <DateInput style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        name="stateCode"
        label="State"
        extra="Leave empty for a figure that applies everywhere. A state's own figure wins over it."
      >
        <Input placeholder="e.g. TN" maxLength={5} disabled={!!selected} style={{ textTransform: 'uppercase' }} />
      </Form.Item>

      </div>

      {/* Pinned. These used to sit at the natural end of a form taller than the
          panel, which clipped rather than scrolled - so a figure could be opened
          and then neither saved nor closed. */}
      <div className="statutory-form-actions">
        <Space>
          <PermissionGuard module={MODULE_ID} operation={selected ? 'update' : 'add'}>
            <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
              {selected ? 'Save changes' : 'Save figure'}
            </Button>
          </PermissionGuard>
          <Button icon={<CloseOutlined />} onClick={handleClose}>
            {unsavedChanges ? 'Discard' : 'Close'}
          </Button>
        </Space>
        {selected && canDelete && (
          <Button danger type="text" icon={<DeleteOutlined />} onClick={handleDelete}>Remove</Button>
        )}
      </div>
    </Form>
  );

  return (
    <MasterSplitView
      title="Statutory Figures"
      subtitle="The rates, ceilings and limits payroll runs on, and the month each starts applying"
      data={filteredData}
      columns={columns}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      addLabel="Add figure"
      selectedId={selected?.id ?? null}
      isEditing={isEditing}
      renderForm={renderForm}
      onSelectRow={handleSelect}
      onCloseForm={handleClose}
      searchPlaceholder="Search figures..."
      onSearch={(val) => {
        const v = val.toLowerCase();
        setFilteredData(data.filter((r) => `${r.label} ${r.code}`.toLowerCase().includes(v)));
      }}
    />
  );
};

export default StatutoryRateMaster;
