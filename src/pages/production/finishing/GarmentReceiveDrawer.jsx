import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Button, Space, DatePicker, Input, InputNumber, Table } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { createProcessReturn } from '../../../services/production/finishingService';

/**
 * Garment Receive from Process: what comes back against one Process PO, good and
 * rejected. A line can never take back more than is still with the vendor.
 */
const GarmentReceiveDrawer = ({ open, issues, issueId, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [qty, setQty] = useState({});
  const [saving, setSaving] = useState(false);
  const selectedId = Form.useWatch('processIssueId', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ returnDate: dayjs(), processIssueId: issueId ?? undefined });
    setQty({});
  }, [open, issueId, form]);

  const issue = useMemo(() => issues.find((i) => i.id === selectedId), [issues, selectedId]);
  const setLine = (id, field, v) => setQty((q) => ({ ...q, [id]: { ...q[id], [field]: v || 0 } }));
  const over = (l) => ((qty[l.id]?.received || 0) + (qty[l.id]?.rejected || 0)) > l.pendingQty;

  const columns = [
    { title: 'Colour', dataIndex: 'color', width: 140, ellipsis: true },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Issued', dataIndex: 'issueQty', width: 80, align: 'right' },
    { title: 'Back So Far', key: 'back', width: 100, align: 'right', render: (_, l) => l.receivedQty + l.rejectedQty },
    { title: 'With Vendor', dataIndex: 'pendingQty', width: 100, align: 'right', render: (v) => <strong>{v}</strong> },
    ...[['received', 'Received'], ['rejected', 'Rejected']].map(([field, title]) => ({
      title, key: field, width: 110, align: 'center',
      render: (_, l) => (
        <InputNumber name={`${field}-${l.id}`} size="small" min={0} max={l.pendingQty} value={qty[l.id]?.[field]}
          style={{ width: 90 }} disabled={l.pendingQty === 0} status={over(l) ? 'error' : undefined}
          onChange={(v) => setLine(l.id, field, v)} />
      ),
    })),
  ];

  const lines = issue?.lines || [];
  const received = lines.reduce((s, l) => s + (qty[l.id]?.received || 0), 0);
  const rejected = lines.reduce((s, l) => s + (qty[l.id]?.rejected || 0), 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (lines.some(over)) return message.warning('A line takes back more than is still with the vendor');
      const payloadLines = lines
        .map((l) => ({ issueLineId: l.id, receivedQty: qty[l.id]?.received || 0, rejectedQty: qty[l.id]?.rejected || 0 }))
        .filter((l) => l.receivedQty + l.rejectedQty > 0);
      if (!payloadLines.length) return message.warning('Enter what was received on at least one line');
      setSaving(true);
      const saved = await createProcessReturn({
        processIssueId: values.processIssueId,
        returnDate: values.returnDate.format('YYYY-MM-DD'),
        vendorDcNo: values.vendorDcNo.trim(),
        remarks: values.remarks || null,
        lines: payloadLines,
      });
      message.success(`${saved.returnNo} received against ${saved.issueNo}`);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || 'Failed to receive garments');
    } finally { setSaving(false); }
  };

  return (
    <Drawer title="Garment Receive from Process" size={780} open={open} onClose={onClose} destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Received <strong>{received}</strong> · Rejected <strong>{rejected}</strong></span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Receive</Button>
        </Space>
      )}>
      <Form form={form} layout="vertical">
        <Space size="middle" align="start" wrap>
          <Form.Item name="processIssueId" label="Process PO #" rules={[{ required: true, message: 'Select the Process PO' }]}>
            <FormSelect placeholder="Garments out with a vendor" style={{ width: 320 }} onChange={() => setQty({})}
              options={issues.map((i) => ({
                value: i.id,
                label: `${i.issueNo} · ${i.processName} · ${i.workOrderNo} (${i.totalPendingQty} out)`,
              }))} />
          </Form.Item>
          <Form.Item name="returnDate" label="Receipt Date" rules={[{ required: true, message: 'Receipt date is required' }]}>
            <DatePicker format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="vendorDcNo" label="Vendor DC #"
            rules={[{ required: true, whitespace: true, message: "Enter the vendor's DC number" }]}>
            <Input maxLength={50} style={{ width: 160 }} placeholder="The vendor's challan" />
          </Form.Item>
        </Space>
        <Table rowKey="id" size="small" columns={columns} dataSource={lines} pagination={false}
          locale={{ emptyText: 'Select the Process PO the garments came back against' }} />
        <Form.Item name="remarks" label="Remarks" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default GarmentReceiveDrawer;
