import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../../components/MasterSplitView';
import { Form, Input, InputNumber, Button, Space, App, DatePicker } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import { getAllPtSlabs, createPtSlab, updatePtSlab, deletePtSlab } from '../../../services/hr/ptSlabService';

const MODULE_ID = 'hr-masters';

const PtSlabMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  // Viewing an existing slab without update rights is read-only, rather than
  // an editable form whose save button is hidden.
  const isReadOnly = Boolean(selectedId) && !canUpdate;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllPtSlabs();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { title: 'State', dataIndex: 'stateCode', width: 80, sorter: (a, b) => (a.stateCode || '').localeCompare(b.stateCode || '') },
    { title: 'From Amount', dataIndex: 'halfYearlyIncomeFrom', width: 120, align: 'right', render: (v) => v?.toLocaleString('en-IN') },
    // A blank cell made the open-ended top slab look like bad data.
    { title: 'To Amount', dataIndex: 'halfYearlyIncomeTo', width: 120, align: 'right',
      render: (v) => (v == null ? 'No limit' : v.toLocaleString('en-IN')) },
    { title: 'PT Amount', dataIndex: 'ptAmount', width: 110, align: 'right', render: (v) => v != null ? `\u20B9${v.toLocaleString('en-IN')}` : '-' },
    { title: 'Effective From', dataIndex: 'effectiveFrom', width: 120, render: (v) => v ? dayjs(v).format('DD-MMM-YYYY') : '-' },
  ];

  const handleSelect = useCallback((record) => {
    if (unsavedChanges) {
      modal.confirm({
        title: 'Unsaved changes',
        content: 'Discard changes?',
        onOk: () => {
          skipDirty.current = true;
          setSelectedId(record.id);
          setIsEditing(true);
          form.setFieldsValue({
            ...record,
            effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : null,
          });
          markDirty(false);
          skipDirty.current = false;
        },
      });
      return;
    }
    setSelectedId(record.id);
    setIsEditing(true);
    skipDirty.current = true;
    form.setFieldsValue({
      ...record,
      effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : null,
    });
    skipDirty.current = false;
  }, [form, modal, unsavedChanges, markDirty]);

  const handleAdd = useCallback(() => {
    setSelectedId(null);
    setIsEditing(true);
    skipDirty.current = true;
    form.resetFields();
    form.setFieldsValue({ stateCode: 'TN' });
    skipDirty.current = false;
  }, [form]);

  const handleClose = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        ...values,
        effectiveFrom: values.effectiveFrom?.format('YYYY-MM-DD'),
      };
      if (selectedId) {
        await updatePtSlab(selectedId, payload);
        message.success('PT slab updated');
      } else {
        await createPtSlab(payload);
        message.success('PT slab created');
      }
      handleClose();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedId, message, handleClose, fetchData]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    modal.confirm({
      title: 'Delete PT Slab?',
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePtSlab(selectedId);
          message.success('PT slab deleted');
          handleClose();
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message; adding another here showed two.
        }
      },
    });
  }, [selectedId, modal, message, handleClose, fetchData]);

  const renderForm = () => (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
      disabled={isReadOnly}
    >
      <Form.Item name="stateCode" label="State Code" rules={[{ required: true, message: 'Enter state code' }]}>
        <Input placeholder="e.g., TN" maxLength={2} style={{ textTransform: 'uppercase' }} />
      </Form.Item>
      <Form.Item name="halfYearlyIncomeFrom" label="From Amount (Half-Yearly)" rules={[{ required: true, message: 'Enter from amount' }]}>
        <InputNumber style={{ width: '100%' }} min={0} prefix={'\u20B9'} />
      </Form.Item>
      {/*
        Optional on purpose. half_yearly_income_to is nullable, and the PT
        calculation reads a null upper bound as "no ceiling" - which is what the
        top slab needs. Requiring it here made the highest slab impossible to
        enter, so every income above the last bounded slab matched no slab at
        all and was charged nothing.
      */}
      <Form.Item
        name="halfYearlyIncomeTo"
        label="To Amount (Half-Yearly)"
        extra="Leave empty for the highest slab, which has no upper limit."
        rules={[
          {
            validator: (_, value) => {
              if (value == null || value === '') return Promise.resolve();
              const from = form.getFieldValue('halfYearlyIncomeFrom');
              if (from != null && Number(value) <= Number(from)) {
                return Promise.reject(new Error('To amount must be greater than the from amount'));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <InputNumber style={{ width: '100%' }} min={0} prefix={'\u20B9'} placeholder="Leave empty for no upper limit" />
      </Form.Item>
      <Form.Item name="ptAmount" label="PT Amount" rules={[{ required: true, message: 'Enter PT amount' }]}>
        <InputNumber style={{ width: '100%' }} min={0} prefix={'\u20B9'} />
      </Form.Item>
      <Form.Item name="effectiveFrom" label="Effective From" rules={[{ required: true, message: 'Select date' }]}>
        <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
      </Form.Item>
      <Space>
        <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            {selectedId ? 'Update' : 'Create'}
          </Button>
        </PermissionGuard>
        {selectedId && canDelete && (
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>Delete</Button>
        )}
        <Button icon={<CloseOutlined />} onClick={handleClose}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
      </Space>
    </Form>
  );

  return (
    <MasterSplitView
      title="Professional Tax Slabs"
      subtitle="Manage PT slab rates by state"
      data={filteredData}
      columns={columns}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      addLabel="Add PT Slab"
      selectedId={selectedId}
      isEditing={isEditing}
      renderForm={renderForm}
      onSelectRow={handleSelect}
      onCloseForm={handleClose}
      searchPlaceholder="Search slabs..."
      onSearch={(val) => {
        const v = val.toLowerCase();
        setFilteredData(data.filter((r) => (r.stateCode || '').toLowerCase().includes(v)));
      }}
    />
  );
};

export default PtSlabMaster;
