import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Drawer, Form, Input, Select, Switch, Table, Tag } from 'antd';
import { EditOutlined, StarFilled } from '@ant-design/icons';
import { listActivities, saveActivity } from '../../../services/tna/tnaService';
import { ACTIVITY_GROUPS, GROUP_COLORS, SOURCE_MODULES } from '../../../utils/tnaConstants';

const ROLES = ['Merchandiser', 'Merch Manager', 'Production Planner', 'CAD Room', 'Cutting Master', 'Production Manager', 'Store Keeper', 'QC'];
const Flag = ({ on, label }) => (on ? <Tag style={{ fontSize: 10 }}>{label}</Tag> : null);

/** §7.1 — the single activity library every template references. */
const ActivityMasterTab = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { listActivities().then(setRows).catch(() => message.error('Failed to load activity master')); }, [message]);
  useEffect(load, [load]);

  const openEdit = useCallback((r) => { setEditing(r); form.setFieldsValue(r); }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveActivity({ ...editing, ...values });
      message.success(`${values.name} saved`);
      setEditing(null);
      load();
    } catch (e) {
      if (!e?.errorFields) message.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 70, render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span> },
    { title: 'Activity', dataIndex: 'name', render: (v, r) => <span>{v} {r.milestone && <StarFilled style={{ color: 'var(--accent-color)', fontSize: 11 }} />}</span> },
    { title: 'Group', dataIndex: 'group', width: 110, render: (v) => <Tag style={{ borderColor: GROUP_COLORS[v], color: GROUP_COLORS[v] }}>{v}</Tag> },
    { title: 'Responsible', dataIndex: 'defaultRole', width: 150 },
    { title: 'Actual From', dataIndex: 'sourceModule', width: 110, render: (v) => <Tag color={v === 'Manual' ? 'default' : 'blue'}>{v}</Tag> },
    { title: 'Flags', key: 'flags', render: (_, r) => <><Flag on={r.buyerDependent} label="Buyer-dep" /><Flag on={r.requiresAttachment} label="Attach req." /></> },
    { title: '', key: 'a', width: 50, render: (_, r) => <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ], [openEdit]);

  return (
    <>
      <Table rowKey="code" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 820 }} />
      <Drawer
        title={`Edit Activity — ${editing?.code || ''}`}
        open={!!editing}
        onClose={() => setEditing(null)}
        size={420}
        destroyOnHidden
        extra={<Button type="primary" loading={saving} onClick={handleSave}>Save</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Activity name" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="shortName" label="Short name (grid / mobile)"><Input maxLength={30} /></Form.Item>
          <Form.Item name="group" label="Group" rules={[{ required: true }]}><Select options={ACTIVITY_GROUPS.map((g) => ({ value: g, label: g }))} /></Form.Item>
          <Form.Item name="defaultRole" label="Default responsible role" rules={[{ required: true }]}><Select options={ROLES.map((r) => ({ value: r, label: r }))} /></Form.Item>
          <Form.Item name="sourceModule" label="Actual date source" rules={[{ required: true }]} tooltip="Determines whether the actual date is auto-captured">
            <Select options={SOURCE_MODULES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="milestone" label="Milestone (management dashboard & buyer reports)" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="buyerDependent" label="Buyer-dependent (excluded from internal efficiency)" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="requiresAttachment" label="Requires attachment to complete" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
    </>
  );
};

export default ActivityMasterTab;
