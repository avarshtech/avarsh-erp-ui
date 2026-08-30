import { useCallback, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input } from 'antd';
import { FormSelect } from '../../../components/form';
import { RETURN_SHORTFALL_REASONS } from '../../../utils/cuttingConstants';
import { saveProcessReturn } from '../../../services/production/cuttingService';

/** FR-10 — Receive from Vendor: receive processed panels back; shortfalls need a reason. */
const ProcessReturnDrawer = ({ open, issues, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [panelIssueId, setPanelIssueId] = useState(null);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const openIssues = useMemo(() => issues.filter((i) => i.status !== 'FULLY_RETURNED'), [issues]);
  const issue = useMemo(() => issues.find((i) => i.id === panelIssueId), [issues, panelIssueId]);

  const handleIssueSelect = useCallback((id, list) => {
    setPanelIssueId(id);
    const src = list.find((i) => i.id === id);
    setLines((src?.lines || []).map((l) => ({
      process: src.process, panel: l.panel, size: l.size, issuedQty: l.issueQty, returnQty: null, reason: null, remarks: '',
    })));
  }, []);

  const setLine = useCallback((idx, field, val) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  }, []);

  const columns = useMemo(() => [
    { title: 'Panel', dataIndex: 'panel', width: 100 },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Issued', dataIndex: 'issuedQty', width: 80, align: 'right' },
    {
      title: 'Return Qty', dataIndex: 'returnQty', width: 110, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} max={r.issuedQty} value={v} style={{ width: 90 }}
          onChange={(val) => setLine(idx, 'returnQty', val)} />
      ),
    },
    {
      title: 'Difference', key: 'diff', width: 100, align: 'center',
      render: (_, r) => {
        const diff = r.issuedQty - (r.returnQty || 0);
        return <span style={{ color: diff > 0 ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{diff}</span>;
      },
    },
    {
      title: 'Shortfall Reason', dataIndex: 'reason', width: 170,
      render: (v, r, idx) => {
        const diff = r.issuedQty - (r.returnQty || 0);
        if (diff <= 0 || r.returnQty == null) return null;
        return (
          <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Why short?"
            options={RETURN_SHORTFALL_REASONS.map((x) => ({ value: x, label: x }))} onChange={(val) => setLine(idx, 'reason', val)} />
        );
      },
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 170,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setLine(idx, 'remarks', e.target.value)} />,
    },
  ], [setLine]);

  const totalReturn = lines.reduce((s, l) => s + (l.returnQty || 0), 0);

  const handleSave = async () => {
    if (!issue) return message.warning('Select the panel issue being returned');
    const entered = lines.filter((l) => l.returnQty != null);
    if (!entered.length) return message.warning('Enter the returned quantity for at least one panel');
    const missingReason = entered.some((l) => l.issuedQty - l.returnQty > 0 && !l.reason);
    if (missingReason) return message.error('Every shortfall needs a reason (Lost / Damaged / Retained / Pending)');
    setSaving(true);
    try {
      const saved = await saveProcessReturn({
        panelIssueId, cutPoId: issue.cutPoId, date: new Date().toISOString().slice(0, 10),
        lines: entered.map((l) => ({ ...l, returnQty: l.returnQty || 0 })),
      });
      message.success(`${saved.returnDcNo} saved — returned panels go to Panel Check before bundling`);
      setLines([]); setPanelIssueId(null);
      onSaved();
    } catch { message.error('Failed to save return DC'); } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Receive from Vendor"
      size={720}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Returning: <strong>{totalReturn}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save &amp; Print Receipt</Button>
        </Space>
      )}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Panel Issue with pending returns</div>
        <FormSelect value={panelIssueId} style={{ width: 360 }} placeholder="Select panel issue"
          options={openIssues.map((i) => ({
            value: i.id,
            label: `${i.panelPoNo} · ${i.process} · ${cutPos.find((p) => p.id === i.cutPoId)?.cutPoNo || ''}`,
          }))}
          onChange={(id) => handleIssueSelect(id, issues)} />
      </div>
      <Table rowKey={(r) => lines.indexOf(r)} size="small" columns={columns} dataSource={lines} pagination={false} scroll={{ x: 800 }}
        locale={{ emptyText: 'Partial receipts allowed — multiple vendor receipts can be raised against one issue' }} />
    </Drawer>
  );
};

export default ProcessReturnDrawer;
