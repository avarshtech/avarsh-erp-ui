import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Button, Space, DatePicker, Input, InputNumber, Table, Descriptions, AutoComplete, Tag } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { getActiveProcesses } from '../../../services/master/processService';
import { getProcessWorkOrders, getProcessVendors, createProcessIssue } from '../../../services/production/finishingService';
import GarmentIssueFromPo from './GarmentIssueFromPo';

const EMPTY_PO = { jobWorkPoId: null, qty: {} };

/**
 * Garment Issue to Process: an approved Work Order's garments sent out for one process. An in-house Work Order
 * issues against an approved Garment Process PO for its order — the PO fixes the process, vendor and dates, and
 * the issue is dated today (D4, D7). An outsourced one keeps the free-text issue: each colour and size can go out
 * up to its planned quantity less what earlier issues already sent to the same process.
 */
const GarmentIssueDrawer = ({ open, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [workOrders, setWorkOrders] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [qty, setQty] = useState({});
  const [fromPo, setFromPo] = useState(EMPTY_PO);
  const [saving, setSaving] = useState(false);
  const woId = Form.useWatch('workOrderId', form);
  const processId = Form.useWatch('processId', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ issueDate: dayjs() });
    setQty({});
    setFromPo(EMPTY_PO);
    // garments go out for the cost sheet's Manufacturing processes (washing, printing, embroidery…)
    Promise.all([getProcessWorkOrders(), getActiveProcesses('Manufacturing'), getProcessVendors()])
      .then(([w, p, v]) => { setWorkOrders(w); setProcesses(p || []); setVendors(v); })
      .catch(() => message.error('Failed to load work orders and processes'));
  }, [open, form, message]);

  const wo = useMemo(() => workOrders.find((w) => w.id === woId), [workOrders, woId]);
  const inHouse = wo?.processingUnitType === 'UNIT';
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

  const total = inHouse
    ? Object.values(fromPo.qty).reduce((s, q) => s + (q || 0), 0)
    : rows.reduce((s, r) => s + (qty[r.key] || 0), 0);

  const payload = (values) => {
    if (inHouse) {
      const lines = Object.entries(fromPo.qty).filter(([, q]) => q > 0).map(([id, q]) => ({ jobWorkPoLineId: Number(id), issueQty: q }));
      if (!fromPo.jobWorkPoId) return 'Pick the approved Garment Process PO these garments go out against';
      return lines.length ? { workOrderId: values.workOrderId, jobWorkPoId: fromPo.jobWorkPoId, remarks: values.remarks || null, lines }
        : 'Enter the quantity to issue on at least one line';
    }
    const lines = rows.filter((r) => (qty[r.key] || 0) > 0).map((r) => ({ color: r.color, size: r.size, issueQty: qty[r.key] }));
    if (!lines.length) return 'Enter the quantity to issue for at least one colour and size';
    return {
      workOrderId: values.workOrderId, processId: values.processId, vendorName: values.vendorName || null,
      issueDate: values.issueDate.format('YYYY-MM-DD'),
      expectedReturnDate: values.expectedReturnDate ? values.expectedReturnDate.format('YYYY-MM-DD') : null,
      remarks: values.remarks || null, lines,
    };
  };

  const handleSave = async () => {
    try {
      const body = payload(await form.validateFields());
      if (typeof body === 'string') return message.warning(body);
      setSaving(true);
      const saved = await createProcessIssue(body);
      message.success(`${saved.issueNo} issued to ${saved.processName}`);
      onSaved();
    } catch {
      // a form error is shown on the field, the API's own message by the interceptor
    } finally { setSaving(false); }
  };

  return (
    <Drawer title="Garment Issue to Process" size={820} open={open} onClose={onClose} destroyOnHidden
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
            <FormSelect placeholder="Approved Work Order" style={{ width: 280 }} onChange={() => { setQty({}); setFromPo(EMPTY_PO); }}
              options={workOrders.map((w) => ({ value: w.id, label: `${w.workOrderNo} · ${w.styleNo || '—'}` }))} />
          </Form.Item>
          {wo && !inHouse && (
            <>
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
            </>
          )}
          {wo && <Tag color={inHouse ? 'blue' : 'orange'} style={{ marginTop: 34 }}>{inHouse ? 'In-house — against a Garment Process PO' : 'Outsourced unit'}</Tag>}
        </Space>
        {wo && (
          <Descriptions size="small" column={3} bordered style={{ marginBottom: 16 }}
            items={[
              { key: 'order', label: 'Order #', children: wo.orderNo },
              { key: 'style', label: 'Style #', children: wo.styleNo },
              { key: 'buyer', label: 'Buyer', children: wo.buyerName },
            ]} />
        )}
        {inHouse
          ? <GarmentIssueFromPo key={wo.id} wo={wo} value={fromPo} onChange={setFromPo} />
          : (
            <Table rowKey="key" size="small" columns={columns} dataSource={rows} pagination={false}
              locale={{ emptyText: woId ? 'This Work Order has no planned quantities' : 'Select a Work Order to list its colours and sizes' }} />
          )}
        <Form.Item name="remarks" label="Remarks" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default GarmentIssueDrawer;
