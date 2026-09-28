import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Button, Space, DatePicker, Input, InputNumber, Table, Descriptions, AutoComplete } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { getActiveProcesses } from '../../../services/master/processService';
import { getProcessWorkOrders, getProcessVendors, createProcessIssue } from '../../../services/production/finishingService';

/**
 * Garment Issue to Process: an approved Work Order's garments sent to a vendor for
 * one process. Each colour and size can go out up to its planned quantity less what
 * earlier issues already sent to the same process.
 */
const GarmentIssueDrawer = ({ open, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [workOrders, setWorkOrders] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [qty, setQty] = useState({});
  const [saving, setSaving] = useState(false);
  const woId = Form.useWatch('workOrderId', form);
  const processId = Form.useWatch('processId', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ issueDate: dayjs() });
    setQty({});
    // garments go out for the cost sheet's Manufacturing processes (washing, printing, embroidery…)
    Promise.all([getProcessWorkOrders(), getActiveProcesses('Manufacturing'), getProcessVendors()])
      .then(([w, p, v]) => { setWorkOrders(w); setProcesses(p || []); setVendors(v); })
      .catch(() => message.error('Failed to load work orders and processes'));
  }, [open, form, message]);

  const wo = useMemo(() => workOrders.find((w) => w.id === woId), [workOrders, woId]);
  const rows = useMemo(() => (wo?.rows || []).map((r) => {
    const sent = processId ? (r.issuedByProcess?.[processId] || 0) : 0;
    return { ...r, key: `${r.color}|${r.size}`, sent, balance: Math.max(0, r.plannedQty - sent) };
  }), [wo, processId]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.name })), [vendors]);

  const columns = useMemo(() => [
    { title: 'Colour', dataIndex: 'color', width: 150, ellipsis: true },
    { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
    { title: 'Planned', dataIndex: 'plannedQty', width: 90, align: 'right' },
    { title: 'Already Sent', dataIndex: 'sent', width: 110, align: 'right', render: (v) => (processId ? v : '—') },
    { title: 'Balance', dataIndex: 'balance', width: 90, align: 'right', render: (v) => (processId ? <strong>{v}</strong> : '—') },
    { title: 'Issue Qty', key: 'qty', width: 120, align: 'center',
      render: (_, r) => (
        <InputNumber name={`issue-${r.key}`} size="small" min={0} max={r.balance} value={qty[r.key]} style={{ width: 100 }}
          disabled={!processId || r.balance === 0} onChange={(v) => setQty((q) => ({ ...q, [r.key]: v }))} />
      ) },
  ], [processId, qty]);

  const total = rows.reduce((s, r) => s + (qty[r.key] || 0), 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const lines = rows.filter((r) => (qty[r.key] || 0) > 0)
        .map((r) => ({ color: r.color, size: r.size, issueQty: qty[r.key] }));
      if (!lines.length) return message.warning('Enter the quantity to issue for at least one colour and size');
      setSaving(true);
      const saved = await createProcessIssue({
        workOrderId: values.workOrderId,
        processId: values.processId,
        vendorName: values.vendorName || null,
        issueDate: values.issueDate.format('YYYY-MM-DD'),
        expectedReturnDate: values.expectedReturnDate ? values.expectedReturnDate.format('YYYY-MM-DD') : null,
        remarks: values.remarks || null,
        lines,
      });
      message.success(`${saved.issueNo} issued to ${saved.processName}`);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || 'Failed to issue garments');
    } finally { setSaving(false); }
  };

  return (
    <Drawer title="Garment Issue to Process" size={780} open={open} onClose={onClose} destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total: <strong>{total}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Issue</Button>
        </Space>
      )}>
      <Form form={form} layout="vertical">
        <Space size="middle" align="start" wrap>
          <Form.Item name="workOrderId" label="Work Order" rules={[{ required: true, message: 'Select the Work Order' }]}>
            <FormSelect placeholder="Approved Work Order" style={{ width: 280 }} onChange={() => setQty({})}
              options={workOrders.map((w) => ({ value: w.id, label: `${w.workOrderNo} · ${w.styleNo || '—'}` }))} />
          </Form.Item>
          <Form.Item name="processId" label="Process" rules={[{ required: true, message: 'Select the process' }]}>
            <FormSelect placeholder="Washing, printing…" style={{ width: 200 }} onChange={() => setQty({})}
              options={processes.map((p) => ({ value: p.id, label: p.processName }))} />
          </Form.Item>
          <Form.Item name="vendorName" label="Vendor">
            <AutoComplete placeholder="Process vendor" style={{ width: 220 }} options={vendorOptions}
              filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="issueDate" label="Issue Date" rules={[{ required: true, message: 'Issue date is required' }]}>
            <DatePicker format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="expectedReturnDate" label="Due Back">
            <DatePicker format="DD-MMM-YYYY" />
          </Form.Item>
        </Space>
        {wo && (
          <Descriptions size="small" column={3} bordered style={{ marginBottom: 16 }}
            items={[
              { key: 'order', label: 'Order #', children: wo.orderNo },
              { key: 'style', label: 'Style #', children: wo.styleNo },
              { key: 'buyer', label: 'Buyer', children: wo.buyerName },
            ]} />
        )}
        <Table rowKey="key" size="small" columns={columns} dataSource={rows} pagination={false}
          locale={{ emptyText: woId ? 'This Work Order has no planned quantities' : 'Select a Work Order to list its colours and sizes' }} />
        <Form.Item name="remarks" label="Remarks" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default GarmentIssueDrawer;
