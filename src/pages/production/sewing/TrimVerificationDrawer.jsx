import { useCallback, useEffect, useState } from 'react';
import { App, Drawer, Button, Space, Segmented, Table, Input, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import {
  CHECKLIST_MATERIALS, CHECKLIST_APPROVALS, CHECKLIST_STATUSES, CHECK_TYPES, ISSUE_SEVERITIES,
} from '../../../utils/sewingConstants';
import { saveTrimCard } from '../../../services/production/sewingService';

const STATUS_COLORS = { ACTUAL: 'var(--success-color)', ALTERNATE: 'var(--warning-color)', MISSING: 'var(--error-color)', NOT_APPLICABLE: 'var(--text-secondary)' };

const emptyCard = (orderId) => ({
  orderId, date: dayjs().format('YYYY-MM-DD'), checkType: 'IN_LINE', verifiedBy: '', approvedBy: '',
  materials: Object.fromEntries(CHECKLIST_MATERIALS.map((m) => [m, 'ACTUAL'])),
  approvals: Object.fromEntries(CHECKLIST_APPROVALS.map((a) => [a, 'ACTUAL'])),
  issues: [],
});

/** PRD 4.5 drawer — checklist statuses per item + structured issue entries. */
const TrimVerificationDrawer = ({ open, record, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [card, setCard] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCard(record ? JSON.parse(JSON.stringify(record)) : emptyCard(orders[0]?.id));
  }, [open, record, orders]);

  const setItem = useCallback((group, item, status) => {
    setCard((prev) => ({ ...prev, [group]: { ...prev[group], [item]: status } }));
  }, []);

  const setIssue = useCallback((idx, field, val) => {
    setCard((prev) => ({ ...prev, issues: prev.issues.map((x, i) => (i === idx ? { ...x, [field]: val } : x)) }));
  }, []);

  const handleSave = async () => {
    if (!card.verifiedBy.trim()) return message.warning('Enter who verified this card');
    setSaving(true);
    try {
      const saved = await saveTrimCard({ ...card, id: record?.id });
      message.success(`${saved.cardNo} saved — gate is ${saved.status === 'ALL_CLEAR' ? 'ALL CLEAR' : 'blocked (issues found)'}`);
      onSaved();
    } catch { message.error('Failed to save card'); } finally { setSaving(false); }
  };

  if (!card) return null;

  const ChecklistGroup = ({ title, group, items }) => (
    <div style={{ marginBottom: 12 }}>
      <Divider orientation="left" style={{ margin: '8px 0' }}>{title}</Divider>
      <Space wrap size={[16, 10]}>
        {items.map((item) => (
          <div key={item} style={{ minWidth: 150 }}>
            <div style={{ fontSize: 12, color: STATUS_COLORS[card[group][item]], marginBottom: 2 }}>{item}</div>
            <Segmented
              size="small"
              value={card[group][item]}
              options={CHECKLIST_STATUSES.map((s) => ({ value: s, label: s === 'NOT_APPLICABLE' ? 'N/A' : s.slice(0, 3) }))}
              onChange={(v) => setItem(group, item, v)}
            />
          </div>
        ))}
      </Space>
    </div>
  );

  return (
    <Drawer
      title={record ? `Verification Card — ${record.cardNo}` : 'New Material & Trim Verification Card'}
      size={760}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save Card</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 8 }}>
        <FormSelect value={card.orderId} style={{ width: 250 }} disabled={Boolean(record)}
          options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
          onChange={(v) => setCard((prev) => ({ ...prev, orderId: v }))} />
        <FormSelect value={card.checkType} style={{ width: 130 }}
          options={CHECK_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
          onChange={(v) => setCard((prev) => ({ ...prev, checkType: v }))} />
        <Input value={card.verifiedBy} style={{ width: 170 }} placeholder="Verified by (QC)"
          onChange={(e) => setCard((prev) => ({ ...prev, verifiedBy: e.target.value }))} />
        <Input value={card.approvedBy} style={{ width: 170 }} placeholder="Approved by (PM/QA)"
          onChange={(e) => setCard((prev) => ({ ...prev, approvedBy: e.target.value }))} />
      </Space>

      <ChecklistGroup title="Materials" group="materials" items={CHECKLIST_MATERIALS} />
      <ChecklistGroup title="Approvals & Tests" group="approvals" items={CHECKLIST_APPROVALS} />

      <Divider orientation="left" style={{ margin: '8px 0' }}>
        Issues Found
        <Button icon={<PlusOutlined />} size="small" style={{ marginLeft: 12 }}
          onClick={() => setCard((prev) => ({ ...prev, issues: [...prev.issues, { description: '', severity: 'MAJOR', rootCause: '', action: '', status: 'OPEN', resolvedOn: null }] }))}>
          Add Issue
        </Button>
      </Divider>
      <Table
        rowKey={(r) => card.issues.indexOf(r)} size="small" pagination={false} dataSource={card.issues}
        columns={[
          { title: 'Issue', dataIndex: 'description', width: 200, render: (v, _, idx) => <Input size="small" value={v} placeholder="e.g. Found flap, pcs center off" onChange={(e) => setIssue(idx, 'description', e.target.value)} /> },
          { title: 'Severity', dataIndex: 'severity', width: 110, render: (v, _, idx) => <FormSelect size="small" value={v} style={{ width: 95 }} options={ISSUE_SEVERITIES.map((s) => ({ value: s, label: s }))} onChange={(val) => setIssue(idx, 'severity', val)} /> },
          { title: 'Root Cause', dataIndex: 'rootCause', width: 150, render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setIssue(idx, 'rootCause', e.target.value)} /> },
          { title: 'Corrective Action', dataIndex: 'action', width: 180, render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setIssue(idx, 'action', e.target.value)} /> },
          { title: 'Status', dataIndex: 'status', width: 120, render: (v, _, idx) => <FormSelect size="small" value={v} style={{ width: 105 }} options={['OPEN', 'RESOLVED'].map((s) => ({ value: s, label: s }))} onChange={(val) => setIssue(idx, 'status', val)} /> },
          {
            title: '', key: 'del', width: 46, align: 'center',
            render: (_, __, idx) => (
              <Button size="small" type="text" danger icon={<DeleteOutlined />}
                onClick={() => setCard((prev) => ({ ...prev, issues: prev.issues.filter((_, i) => i !== idx) }))} />
            ),
          },
        ]}
        locale={{ emptyText: 'No issues logged — card can go ALL CLEAR' }}
      />
    </Drawer>
  );
};

export default TrimVerificationDrawer;
