import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Table, Descriptions, Button, Space, DatePicker, Alert } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { formatNumber } from '../../../utils/formatters';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { createReceipt, getPendingRolls } from '../../../services/production/cuttingService';

/**
 * FR-01 drawer — lists the rolls inventory has issued to the selected Cut PO but
 * the floor has not taken in yet; the operator ticks the ones that physically
 * arrived. Unticked rolls are saved as outstanding, which marks the receipt
 * partially received.
 */
const FabricReceiptDrawer = ({ open, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { fabricTypes } = useCuttingMasters();
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loadingRolls, setLoadingRolls] = useState(false);
  const [saving, setSaving] = useState(false);
  const cutPoId = Form.useWatch('cutPoId', form);
  const po = useMemo(() => cutPos.find((p) => p.id === cutPoId), [cutPos, cutPoId]);

  useEffect(() => {
    if (!open || !cutPoId) { setRolls([]); return; }
    setLoadingRolls(true);
    getPendingRolls(cutPoId)
      .then((data) => {
        setRolls(data);
        setSelectedKeys(data.map((r) => r.rollNo)); // received unless the operator says otherwise
      })
      .catch(() => message.error('Failed to load issued rolls'))
      .finally(() => setLoadingRolls(false));
  }, [open, cutPoId, message]);

  const columns = useMemo(() => [
    { title: 'Roll #', dataIndex: 'rollNo', width: 140, render: (v) => <code>{v}</code> },
    { title: 'Fabric', dataIndex: 'fabricType', width: 180, ellipsis: true },
    {
      title: 'Issued Qty', dataIndex: 'weight', width: 120, align: 'right',
      render: (v, r) => `${formatNumber(v, 3)} ${r.uom || ''}`,
    },
    { title: 'Color', dataIndex: 'color', width: 110 },
    { title: 'Shade Lot', dataIndex: 'shadeLot', width: 110, align: 'center' },
  ], []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!rolls.length) return message.warning('No issued rolls are pending receipt for this Cut PO');
      if (!selectedKeys.length) return message.warning('Tick at least one roll that was received');
      setSaving(true);
      await createReceipt({
        cuttingPoId: values.cutPoId,
        receiptDate: values.receiptDate.format('YYYY-MM-DD'),
        fabricType: values.fabricType,
        receivedBy: values.receivedBy,
        rolls: rolls.map((r) => ({
          materialIssueItemId: r.materialIssueItemId,
          fabricStockId: r.fabricStockId,
          rollNo: r.rollNo,
          color: r.color,
          shadeLot: r.shadeLot,
          weight: r.weight,
          received: selectedKeys.includes(r.rollNo),
        })),
      });
      message.success('Fabric receipt saved');
      form.resetFields();
      setSelectedKeys([]);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return; // validation shown inline
      message.error('Failed to save receipt');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="New Fabric Receipt"
      size={780}
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
      <Form form={form} layout="vertical" initialValues={{ receiptDate: dayjs() }}>
        <Space size="large" align="start" wrap>
          <Form.Item name="cutPoId" label="Cut PO #" rules={[{ required: true, message: 'Select Cut PO' }]} style={{ minWidth: 260 }}>
            <FormSelect placeholder="Select active Cut PO"
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))} />
          </Form.Item>
          <Form.Item name="fabricType" label="Fabric Type" rules={[{ required: true, message: 'Select fabric type' }]}
            tooltip="Sets the relaxation window and whether rolls are weighed in kg or measured in metres">
            <FormSelect placeholder="Select fabric type" style={{ width: 220 }}
              options={fabricTypes.map((f) => ({ value: f.name, label: `${f.name} (${f.category})` }))} />
          </Form.Item>
          <Form.Item name="receiptDate" label="Date" rules={[{ required: true }]}>
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
            ]}
          />
        )}
        {cutPoId && !loadingRolls && rolls.length === 0 && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            title="No rolls are awaiting receipt for this Cut PO"
            description="Inventory has not issued fabric against it yet, or every issued roll has already been received." />
        )}
        <Table
          rowKey="rollNo"
          size="small"
          columns={columns}
          dataSource={rolls}
          loading={loadingRolls}
          pagination={false}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: 'Select a Cut PO to load the rolls issued to it' }}
          footer={() => (
            <span style={{ color: 'var(--text-secondary)' }}>
              Untick a roll that did not arrive — the receipt is then saved as partially received.
            </span>
          )}
        />
      </Form>
    </Drawer>
  );
};

export default FabricReceiptDrawer;
