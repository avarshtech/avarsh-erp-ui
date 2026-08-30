import { useMemo, useState } from 'react';
import { App, Drawer, Form, Table, Descriptions, Button, Space, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { createReceipt } from '../../../services/production/cuttingService';

/** Mock candidate rolls "issued from stores, awaiting receipt" per Cut PO. */
const candidateRolls = (po) => {
  if (!po) return [];
  const base = po.id * 10;
  return [1, 2, 3].map((i) => ({
    rollNo: `R-${base + i}`, fabricType: po.fabricType, weight: 18 + ((base + i * 3) % 8) + 0.5,
    color: po.color, shadeLot: i === 3 ? 'SL-C' : 'SL-B',
  }));
};

/** FR-01 drawer — Cut PO auto-populates the header; operator ticks rolls physically received. */
const FabricReceiptDrawer = ({ open, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [saving, setSaving] = useState(false);
  const cutPoId = Form.useWatch('cutPoId', form);
  const po = useMemo(() => cutPos.find((p) => p.id === cutPoId), [cutPos, cutPoId]);
  const rolls = useMemo(() => candidateRolls(po), [po]);

  const columns = useMemo(() => [
    { title: 'Roll #', dataIndex: 'rollNo', width: 100, render: (v) => <code>{v}</code> },
    { title: 'Fabric Type', dataIndex: 'fabricType', width: 140 },
    { title: 'Weight', dataIndex: 'weight', width: 110, align: 'right', render: (v) => `${v.toFixed(3)} kg` },
    { title: 'Color', dataIndex: 'color', width: 120 },
    { title: 'Shade Lot', dataIndex: 'shadeLot', width: 100, align: 'center' },
  ], []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedKeys.length) return message.warning('Select at least one received roll');
      setSaving(true);
      await createReceipt({
        cutPoId: values.cutPoId,
        fabricIssueNo: `MIS/26-27/${1000 + Math.floor(Math.random() * 90) + 10}`,
        date: values.date.format('YYYY-MM-DD'),
        rolls: rolls.map((r) => ({ ...r, received: selectedKeys.includes(r.rollNo) })),
      });
      message.success('Fabric receipt saved');
      form.resetFields(); setSelectedKeys([]);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return; // validation handled inline
      message.error('Failed to save receipt');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="New Fabric Receipt"
      size={720}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save Receipt</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
        <Space size="large" align="start" wrap>
          <Form.Item name="cutPoId" label="Cut PO #" rules={[{ required: true, message: 'Select Cut PO' }]} style={{ minWidth: 260 }}>
            <FormSelect placeholder="Select active Cut PO" onChange={() => setSelectedKeys([])}
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))} />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker format="DD-MMM-YYYY" />
          </Form.Item>
        </Space>
        {po && (
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}
            items={[
              { key: 'style', label: 'Style #', children: po.styleNo },
              { key: 'buyer', label: 'Buyer', children: po.buyer },
              { key: 'order', label: 'Order #', children: po.orderNo },
              { key: 'color', label: 'Color', children: po.color },
              { key: 'desc', label: 'Description', children: po.description, span: 2 },
            ]}
          />
        )}
        <Table
          rowKey="rollNo"
          size="small"
          columns={columns}
          dataSource={rolls}
          pagination={false}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: 'Select a Cut PO to load issued rolls' }}
        />
      </Form>
    </Drawer>
  );
};

export default FabricReceiptDrawer;
