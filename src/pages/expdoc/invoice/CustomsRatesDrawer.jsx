import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Button, Col, Drawer, Form, Input, InputNumber, Row, Space, Table, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DeleteConfirm from '../../../components/buttons/DeleteConfirm';
import FormDatePicker from '../../../components/form/FormDatePicker';
import { formatDate } from '../../../utils/formatters';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import {
  listCustomsRates, createCustomsRate, updateCustomsRate, deleteCustomsRate,
} from '../../../services/expdoc/customsRateApi';

const toForm = (r) => ({
  currency: r.currency, exportRate: r.exportRate, effectiveFrom: dayjs(r.effectiveFrom), notificationNo: r.notificationNo,
});

/**
 * The CBIC customs export rates an export invoice converts with (owner, 2026-11-17). Staff key in each
 * notification; an invoice takes the rate in force on its date and keeps it, so a change here never
 * alters an invoice already made.
 */
const CustomsRatesDrawer = ({ open, onClose }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.INVOICE, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.INVOICE, 'update');
  const canDelete = hasPermission(EXPDOC_MODULE.INVOICE, 'delete');
  const formShown = editing ? canUpdate : canAdd;

  // Read afresh on every open: another user may have keyed in a notification since
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setLoading(true);
    listCustomsRates()
      .then((list) => { if (live) setRows(list || []); })
      .catch((e) => { if (!e.errorMessage) message.error(e.message || 'Could not load the customs rates'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, message]);

  const reset = useCallback(() => { setEditing(null); form.resetFields(); }, [form]);

  const startEdit = useCallback((record) => setEditing(record), []);

  // Filled once the form is on screen: for a user who may edit but not add, it mounts only now
  useEffect(() => { if (editing) form.setFieldsValue(toForm(editing)); }, [editing, form]);

  const save = useCallback(async () => {
    const values = await form.validateFields();
    const payload = {
      currency: values.currency.trim().toUpperCase(),
      exportRate: values.exportRate,
      effectiveFrom: values.effectiveFrom.format('YYYY-MM-DD'),
      notificationNo: values.notificationNo?.trim() || null,
      version: editing?.version,
    };
    setSaving(true);
    try {
      const saved = editing ? await updateCustomsRate(editing.id, payload) : await createCustomsRate(payload);
      // The row stays where it is on an edit, and a new one goes on top: a save never reorders the list
      setRows((list) => (editing ? list.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...list]));
      message.success(`${saved.currency} rate from ${formatDate(saved.effectiveFrom)} saved`);
      reset();
    } catch (e) {
      // axiosInstance already shows the refusal (a duplicate date, someone else's change)
      if (!e.errorMessage) message.error(e.message || 'Could not save the rate');
    } finally {
      setSaving(false);
    }
  }, [form, editing, message, reset]);

  const remove = useCallback(async (record) => {
    try {
      await deleteCustomsRate(record.id);
      setRows((list) => list.filter((r) => r.id !== record.id));
      if (editing?.id === record.id) reset();
    } catch (e) {
      if (!e.errorMessage) message.error(e.message || 'Could not delete the rate');
    }
  }, [editing, message, reset]);

  const columns = useMemo(() => [
    { title: 'Currency', dataIndex: 'currency', width: 90 },
    { title: 'Export rate (₹)', dataIndex: 'exportRate', width: 130, align: 'right', render: (v) => Number(v).toFixed(4) },
    { title: 'In force from', dataIndex: 'effectiveFrom', width: 130, render: (v) => formatDate(v) },
    { title: 'Notification no.', dataIndex: 'notificationNo', ellipsis: true, render: (v) => v || '—' },
    {
      title: '', key: 'actions', width: 90, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          {canUpdate && (
            <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} aria-label="Edit" onClick={() => startEdit(r)} /></Tooltip>
          )}
          {canDelete && (
            <DeleteConfirm recordLabel={`${r.currency} from ${formatDate(r.effectiveFrom)}`} onConfirm={() => remove(r)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Delete" />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [canUpdate, canDelete, startEdit, remove]);

  return (
    <Drawer open={open} size={760} title="Customs exchange rates" onClose={() => { setEditing(null); onClose(); }} destroyOnHidden>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="The export rate CBIC notifies twice a month (1st and 3rd Thursday)"
          description="An invoice takes the rate in force on its invoice date: the latest notification on or before it. An invoice keeps the rate it was made with."
        />
        {formShown && (
          <Form form={form} layout="vertical" requiredMark={false}>
            <Row gutter={12} align="bottom">
              <Col xs={12} sm={4}>
                <Form.Item name="currency" label="Currency" rules={[{ required: true, pattern: /^[A-Za-z]{3}$/, message: 'Three letters' }]}>
                  <Input maxLength={3} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={5}>
                <Form.Item name="exportRate" label="Export rate (₹)" rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber min={0.0001} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Item name="effectiveFrom" label="In force from" rules={[{ required: true, message: 'Required' }]}>
                  <FormDatePicker />
                </Form.Item>
              </Col>
              <Col xs={12} sm={9}>
                <Form.Item name="notificationNo" label="Notification no.">
                  <Input maxLength={40} />
                </Form.Item>
              </Col>
            </Row>
            <Space>
              <Button type="primary" loading={saving} onClick={save}>{editing ? 'Save changes' : 'Add rate'}</Button>
              {editing && <Button onClick={reset}>Cancel</Button>}
            </Space>
          </Form>
        )}
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 420 }}
          locale={{ emptyText: 'No customs rates yet. Add the latest CBIC notification for each currency you invoice in.' }}
        />
      </Space>
    </Drawer>
  );
};

export default CustomsRatesDrawer;
