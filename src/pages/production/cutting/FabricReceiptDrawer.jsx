import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Table, Descriptions, Button, Space, DatePicker, Input, Alert, Tag } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { formatNumber } from '../../../utils/formatters';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { createReceipt, updateReceipt, getPendingRolls } from '../../../services/production/cuttingService';

/**
 * FR-01 drawer, in three modes.
 *
 * Creating, it lists the rolls inventory has issued to the selected Cut PO but
 * the floor has not taken in yet; the operator ticks the ones that physically
 * arrived, and unticked rolls are saved as outstanding — which marks the
 * receipt partially received.
 *
 * Opened on a saved receipt it shows that receipt's own rolls: read-only to
 * view, or re-tickable to correct a roll that was recorded wrongly or turned
 * up late.
 */
const FabricReceiptDrawer = ({ open, mode = 'create', record, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { fabricTypes } = useCuttingMasters();
  const { selectCutPo, defaultCutPoId } = useModuleSelection('cutting');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loadingRolls, setLoadingRolls] = useState(false);
  const [saving, setSaving] = useState(false);
  const cutPoId = Form.useWatch('cutPoId', form);
  const po = useMemo(() => cutPos.find((p) => p.id === cutPoId), [cutPos, cutPoId]);

  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const onExisting = Boolean(record) && (isView || isEdit);

  // A saved receipt carries its own rolls; only a new one has to ask inventory
  // what is still outstanding.
  useEffect(() => {
    if (!open) return;
    if (!onExisting) {
      form.resetFields();
      form.setFieldsValue({ receiptDate: dayjs(), cutPoId: defaultCutPoId(cutPos) });
      return;
    }
    form.setFieldsValue({
      cutPoId: record.cuttingPoId,
      receiptDate: dayjs(record.receiptDate),
      fabricType: record.fabricType,
      receivedBy: record.receivedBy,
    });
    setRolls(record.rolls || []);
    setSelectedKeys((record.rolls || []).filter((r) => r.received).map((r) => r.rollNo));
  }, [open, onExisting, record, cutPos, defaultCutPoId, form]);

  useEffect(() => {
    if (!open || onExisting) return;
    if (!cutPoId) { setRolls([]); return; }
    setLoadingRolls(true);
    getPendingRolls(cutPoId)
      .then((data) => {
        setRolls(data);
        setSelectedKeys(data.map((r) => r.rollNo)); // received unless the operator says otherwise
      })
      .catch(() => message.error('Failed to load issued rolls'))
      .finally(() => setLoadingRolls(false));
  }, [open, onExisting, cutPoId, message]);

  const columns = useMemo(() => {
    const base = [
      { title: 'Roll #', dataIndex: 'rollNo', width: 140, render: (v) => <code>{v}</code> },
      { title: 'Fabric', dataIndex: 'fabricType', width: 180, ellipsis: true },
      {
        title: 'Issued Qty', dataIndex: 'weight', width: 120, align: 'right',
        render: (v, r) => `${formatNumber(v, 3)} ${r.uom || ''}`,
      },
      { title: 'Color', dataIndex: 'color', width: 110 },
      { title: 'Shade Lot', dataIndex: 'shadeLot', width: 110, align: 'center' },
    ];
    if (!isView) return base;
    return [...base, {
      title: 'Received', dataIndex: 'received', width: 110, align: 'center',
      render: (v) => (v ? <Tag color="green">Received</Tag> : <Tag color="red">Outstanding</Tag>),
    }];
  }, [isView]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!rolls.length) return message.warning('No issued rolls are pending receipt for this Cut PO');
      if (!selectedKeys.length) return message.warning('Tick at least one roll that was received');
      setSaving(true);
      const payload = {
        cuttingPoId: values.cutPoId,
        receiptDate: values.receiptDate.format('YYYY-MM-DD'),
        fabricType: values.fabricType,
        receivedBy: values.receivedBy,
        rolls: rolls.map((r) => ({
          id: r.id,
          materialIssueItemId: r.materialIssueItemId,
          fabricStockId: r.fabricStockId,
          rollNo: r.rollNo,
          fabricType: r.fabricType,
          color: r.color,
          shadeLot: r.shadeLot,
          weight: r.weight,
          uom: r.uom,
          received: selectedKeys.includes(r.rollNo),
        })),
      };
      if (isEdit) await updateReceipt(record.id, { ...payload, version: record.version });
      else await createReceipt(payload);
      message.success(isEdit ? `${record.receiptNo} updated` : 'Fabric receipt saved');
      form.resetFields();
      setSelectedKeys([]);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return; // validation shown inline
      message.error(e?.response?.data?.message || 'Failed to save receipt');
    } finally { setSaving(false); }
  };

  const title = onExisting
    ? `${isView ? 'Fabric Receipt' : 'Edit Fabric Receipt'} — ${record.receiptNo}`
    : 'New Fabric Receipt';

  return (
    <Drawer
      title={title}
      width={820}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>{isView ? 'Close' : 'Cancel'}</Button>
          {!isView && (
            <Button type="primary" loading={saving} onClick={handleSave}>
              {isEdit ? 'Save Changes' : 'Save Receipt'}
            </Button>
          )}
        </Space>
      )}
    >
      <Form form={form} layout="vertical" disabled={isView} initialValues={{ receiptDate: dayjs() }}>
        <Space size="large" align="start" wrap>
          <Form.Item name="cutPoId" label="Cut PO #" rules={[{ required: true, message: 'Select Cut PO' }]} style={{ minWidth: 260 }}>
            <FormSelect placeholder="Select active Cut PO" disabled={onExisting}
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => selectCutPo(cutPos.find((p) => p.id === v))} />
          </Form.Item>
          <Form.Item name="fabricType" label="Fabric Type" rules={[{ required: true, message: 'Select fabric type' }]}
            tooltip="Sets the relaxation window and whether rolls are weighed in kg or measured in metres">
            <FormSelect placeholder="Select fabric type" style={{ width: 220 }}
              options={fabricTypes.map((f) => ({ value: f.name, label: `${f.name} (${f.category})` }))} />
          </Form.Item>
          <Form.Item name="receiptDate" label="Date" rules={[{ required: true }]}>
            <DatePicker format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="receivedBy" label="Received By">
            <Input placeholder="Storekeeper name" style={{ width: 190 }} />
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
        {!onExisting && cutPoId && !loadingRolls && rolls.length === 0 && (
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
          scroll={{ x: 760 }}
          rowSelection={isView ? undefined : { selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          locale={{ emptyText: onExisting ? 'This receipt has no rolls' : 'Select a Cut PO to load the rolls issued to it' }}
          footer={isView ? undefined : () => (
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
