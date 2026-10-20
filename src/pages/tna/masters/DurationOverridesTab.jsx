import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  listDurationOverrides, saveDurationOverride, deleteDurationOverride, listPlanOptions, getMasterVersion, listMasterVersions,
} from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import DeleteConfirm from '../../../components/buttons/DeleteConfirm';

const { Text } = Typography;

const PRECEDENCE = [
  { tier: 1, source: 'Order-specific duration recorded on the source requirement', note: 'No requirement in the ERP carries a duration field today, so this tier is empty (D-03)' },
  { tier: 2, source: 'Buyer + product-type master', note: 'Overrides below with both a buyer and a product type' },
  { tier: 3, source: 'Product-type master', note: 'Overrides below with a product type only' },
  { tier: 4, source: 'Global activity master default', note: 'The active master version' },
];

/** FR-3.3 — lead-time precedence and the governed duration overrides. */
const DurationOverridesTab = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ buyers: [], productTypes: [], activities: [] });
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => listDurationOverrides().then(setRows).catch((e) => message.error(e.message)), [message]);
  useEffect(() => {
    load();
    Promise.all([listPlanOptions(), listMasterVersions()]).then(async ([plans, versions]) => {
      const active = await getMasterVersion(versions.find((v) => v.status === 'ACTIVE').id);
      setMeta({
        buyers: [...new Set(plans.map((p) => p.buyer))].sort(),
        productTypes: [...new Set(plans.map((p) => p.productType))].sort(),
        activities: active.activities.map((a) => ({ value: a.code, label: `${a.code} ${a.name} (${a.duration} ${a.dayType})` })),
      });
    }).catch(() => {});
  }, [load]);

  const save = async () => {
    const values = await form.validateFields();
    try {
      setRows(await saveDurationOverride({ ...editing, ...values, buyer: values.buyer || null }));
      message.success('Override saved — applies to plans generated from now on');
      setEditing(null);
    } catch (e) { message.error(e.message); }
  };

  const columns = useMemo(() => [
    { title: 'Tier', key: 't', width: 70, render: (_, o) => (o.buyer ? 2 : 3) },
    { title: 'Buyer', dataIndex: 'buyer', width: 130, render: (v) => v || <Text type="secondary">any</Text> },
    { title: 'Product type', dataIndex: 'productType', width: 140 },
    { title: 'Activity', dataIndex: 'activityCode', width: 90 },
    { title: 'Duration', dataIndex: 'duration', width: 90, align: 'right' },
    { title: 'Note', dataIndex: 'note' },
    {
      title: '', key: 'a', width: 130, render: (_, o) => (
        <Space>
          {hasPermission('tna-masters', 'update') && <Button size="small" onClick={() => { form.setFieldsValue(o); setEditing(o); }}>Edit</Button>}
          {hasPermission('tna-masters', 'delete') && (
            <DeleteConfirm recordLabel={`${o.activityCode} for ${o.buyer || 'any buyer'} / ${o.productType}`} onConfirm={async () => setRows(await deleteDurationOverride(o.id))}>
              <Button size="small" danger>Remove</Button>
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [form]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={9}>
        <Table rowKey="tier" size="small" bordered pagination={false} dataSource={PRECEDENCE} title={() => <strong>Lead-time precedence — highest wins</strong>} columns={[{ title: '#', dataIndex: 'tier', width: 40 }, { title: 'Source of duration', dataIndex: 'source' }, { title: 'Note', dataIndex: 'note' }]} />
      </Col>
      <Col xs={24} xl={15}>
        <Space style={{ marginBottom: 10 }}>
          {hasPermission('tna-masters', 'add') && <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing({}); }}>Add override</Button>}
        </Space>
        <Table rowKey="id" size="small" bordered pagination={false} dataSource={rows} columns={columns} />
      </Col>
      <Modal open={!!editing} title={editing?.id ? 'Edit duration override' : 'Add duration override'} onOk={save} onCancel={() => setEditing(null)} destroyOnHidden>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="buyer" label="Buyer (leave empty for any buyer)"><Select allowClear options={meta.buyers.map((b) => ({ value: b, label: b }))} /></Form.Item>
          <Form.Item name="productType" label="Product type" rules={[{ required: true }]}><Select options={meta.productTypes.map((p) => ({ value: p, label: p }))} /></Form.Item>
          <Form.Item name="activityCode" label="Activity" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={meta.activities} /></Form.Item>
          <Form.Item name="duration" label="Duration (in the activity's day type)" rules={[{ required: true }]}><InputNumber min={0} max={120} /></Form.Item>
          <Form.Item name="note" label="Why"><Input maxLength={120} /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

export default DurationOverridesTab;
