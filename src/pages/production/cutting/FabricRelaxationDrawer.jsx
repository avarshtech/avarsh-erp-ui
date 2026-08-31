import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Form, Button, Space, DatePicker, InputNumber, Alert, Tag } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { saveRelaxation } from '../../../services/production/cuttingService';

/** FR-02 drawer — start or complete a relaxation; warns when ended before the fabric-type minimum. */
const FabricRelaxationDrawer = ({ open, record, receipts, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { fabricTypes, fabricTypeByName } = useCuttingMasters();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const fabricType = Form.useWatch('fabricType', form);
  const startTime = Form.useWatch('startTime', form);
  const endTime = Form.useWatch('endTime', form);

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        receiptId: record.receiptId, fabricType: record.fabricType,
        startTime: record.startTime ? dayjs(record.startTime) : null,
        endTime: record.endTime ? dayjs(record.endTime) : null,
        shrinkagePrePct: record.shrinkagePrePct, shrinkagePostPct: record.shrinkagePostPct,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ startTime: dayjs() });
    }
  }, [open, record, form]);

  const minHrs = fabricType ? fabricTypeByName(fabricType)?.minRelaxHours ?? null : null;
  const durationMins = startTime && endTime ? endTime.diff(startTime, 'minute') : null;
  const endedEarly = durationMins != null && minHrs != null && durationMins < minHrs * 60;

  const durationBadge = useMemo(() => {
    if (durationMins == null) return null;
    return (
      <Tag color={endedEarly ? 'red' : 'green'} style={{ fontSize: 14, padding: '4px 12px' }}>
        Duration: {Math.floor(durationMins / 60)}h {String(durationMins % 60).padStart(2, '0')}m
      </Tag>
    );
  }, [durationMins, endedEarly]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveRelaxation({
        id: record?.id,
        version: record?.version,
        receiptId: values.receiptId,
        relaxationDate: dayjs().format('YYYY-MM-DD'),
        startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ss'),
        endTime: values.endTime ? values.endTime.format('YYYY-MM-DDTHH:mm:ss') : null,
        shrinkagePrePct: values.shrinkagePrePct ?? null,
        shrinkagePostPct: values.shrinkagePostPct ?? null,
      });
      message.success(values.endTime ? 'Relaxation completed' : 'Relaxation started');
      onSaved();
    } catch (e) {
      if (e?.errorFields) return;
      message.error('Failed to save relaxation');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title={record ? `Complete Relaxation — ${record.relaxationNo}` : 'Start Fabric Relaxation'}
      size={560}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="receiptId" label="Fabric Receipt #" rules={[{ required: true, message: 'Select receipt' }]}>
          <FormSelect placeholder="Select confirmed receipt" disabled={Boolean(record)}
            options={receipts.map((r) => ({ value: r.id, label: `${r.receiptNo} (${r.receivedRollCount} rolls)` }))}
            onChange={(v) => form.setFieldValue('fabricType', receipts.find((r) => r.id === v)?.fabricType)} />
        </Form.Item>
        <Form.Item name="fabricType" label="Fabric Type" rules={[{ required: true, message: 'Select fabric type' }]}
          extra={minHrs ? `Minimum relaxation for this fabric: ${minHrs} hours` : undefined}>
          <FormSelect placeholder="Select fabric type"
            options={fabricTypes.map((f) => ({ value: f.name, label: `${f.name} (${f.category})` }))} />
        </Form.Item>
        <Space size="large" align="center" wrap>
          <Form.Item name="startTime" label="Start Date & Time" rules={[{ required: true, message: 'Start time required' }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD-MMM-YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="endTime" label="End Date & Time">
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD-MMM-YYYY HH:mm" />
          </Form.Item>
          {durationBadge}
        </Space>
        {endedEarly && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            title={`Ending early — ${fabricType} needs at least ${minHrs} hours of relaxation`}
            description="You can still save, but early release risks shrinkage after cutting. Note the reason in the report." />
        )}
        <Space size="large">
          <Form.Item name="shrinkagePrePct" label="Shrinkage % (pre)">
            <InputNumber min={0} max={20} step={0.1} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="shrinkagePostPct" label="Shrinkage % (post)" tooltip="Used to auto-adjust lay length in the Lay Audit">
            <InputNumber min={0} max={20} step={0.1} style={{ width: 140 }} />
          </Form.Item>
        </Space>
      </Form>
    </Drawer>
  );
};

export default FabricRelaxationDrawer;
