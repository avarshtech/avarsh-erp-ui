import { useCallback, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input } from 'antd';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { saveProcessReturn } from '../../../services/production/cuttingService';

/**
 * FR-10 — Receive from Vendor: processed panels back, good or rejected — both close the line (D6) and an
 * in-house issue posts them to its Cut Panel PO. Whatever is still short needs a reason.
 */
const ProcessReturnDrawer = ({ open, issues, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [panelIssueId, setPanelIssueId] = useState(null);
  const [vendorDcNo, setVendorDcNo] = useState('');
  const [dcMissing, setDcMissing] = useState(false);
  const [lines, setLines] = useState([]);
  const { options } = useCuttingMasters();
  const shortfallReasons = options('RETURN_SHORTFALL_REASON');
  const [saving, setSaving] = useState(false);

  const openIssues = useMemo(() => issues.filter((i) => i.status !== 'FULLY_RETURNED'), [issues]);
  const issue = useMemo(() => issues.find((i) => i.id === panelIssueId), [issues, panelIssueId]);

  const handleIssueSelect = useCallback((id, list) => {
    setPanelIssueId(id);
    const src = list.find((i) => i.id === id);
    setLines((src?.lines || []).filter((l) => (l.pendingQty ?? l.issueQty) > 0).map((l) => ({
      panelIssueLineId: l.id, color: l.color, panel: l.panel, size: l.size,
      issuedQty: l.pendingQty ?? l.issueQty, returnQty: null, rejectedQty: null, shortfallReason: null, remarks: '',
    })));
  }, []);

  const setLine = useCallback((idx, field, val) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  }, []);

  const shortOf = (r) => r.issuedQty - (r.returnQty || 0) - (r.rejectedQty || 0);
  const entered = (r) => r.returnQty != null || r.rejectedQty != null;

  const columns = useMemo(() => [
    ...(issue?.jobWorkPoId ? [{ title: 'Colour', dataIndex: 'color', width: 100, ellipsis: true }] : []),
    { title: 'Panel', dataIndex: 'panel', width: 100 },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'With Vendor', dataIndex: 'issuedQty', width: 95, align: 'right' },
    {
      title: 'Good', dataIndex: 'returnQty', width: 100, align: 'center',
      render: (v, r, idx) => (
        <InputNumber name={`good-${r.panelIssueLineId}`} size="small" min={0} max={r.issuedQty - (r.rejectedQty || 0)} value={v} style={{ width: 85 }}
          onChange={(val) => setLine(idx, 'returnQty', val)} />
      ),
    },
    {
      title: 'Rejected', dataIndex: 'rejectedQty', width: 100, align: 'center',
      render: (v, r, idx) => (
        <InputNumber name={`rejected-${r.panelIssueLineId}`} size="small" min={0} max={r.issuedQty - (r.returnQty || 0)} value={v} style={{ width: 85 }}
          onChange={(val) => setLine(idx, 'rejectedQty', val)} />
      ),
    },
    {
      title: 'Still Short', key: 'diff', width: 95, align: 'center',
      render: (_, r) => <span style={{ color: shortOf(r) > 0 ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>{shortOf(r)}</span>,
    },
    {
      title: 'Shortfall Reason', dataIndex: 'shortfallReason', width: 180,
      render: (v, r, idx) => (shortOf(r) > 0 && entered(r) ? (
        <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Why short?"
          options={shortfallReasons} onChange={(val) => setLine(idx, 'shortfallReason', val)} />
      ) : null),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 160,
      render: (v, r, idx) => <Input name={`remarks-${r.panelIssueLineId}`} size="small" value={v} onChange={(e) => setLine(idx, 'remarks', e.target.value)} />,
    },
  ], [issue, setLine, shortfallReasons]);

  const totalReturn = lines.reduce((s, l) => s + (l.returnQty || 0) + (l.rejectedQty || 0), 0);

  const handleSave = async () => {
    if (!issue) return message.warning('Select the panel issue being returned');
    const dcNo = vendorDcNo.trim();
    if (!dcNo) {
      setDcMissing(true);
      return message.warning("Enter the vendor's DC number — every receipt from a vendor comes on his challan");
    }
    const rows = lines.filter(entered);
    if (!rows.length) return message.warning('Enter the good or rejected quantity for at least one panel');
    if (rows.some((l) => shortOf(l) > 0 && !l.shortfallReason)) return message.error('Every shortfall needs a reason (Lost / Damaged / Retained / Pending)');
    setSaving(true);
    try {
      const saved = await saveProcessReturn({
        panelIssueId, returnDate: new Date().toISOString().slice(0, 10), vendorDcNo: dcNo,
        lines: rows.map((l) => ({ ...l, returnQty: l.returnQty || 0, rejectedQty: l.rejectedQty || 0 })),
      });
      message.success(`${saved.returnDcNo} saved — returned panels go to Panel Check before bundling`);
      setLines([]); setPanelIssueId(null); setVendorDcNo(''); setDcMissing(false);
      onSaved();
    } catch {
      // the API's own message has been shown
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Receive from Vendor" size={820} open={open} onClose={onClose} destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Returning: <strong>{totalReturn}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save &amp; Print Receipt</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap align="end" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Panel Issue with pending returns</div>
          <FormSelect value={panelIssueId} style={{ width: 360 }} placeholder="Select panel issue" aria-label="Panel issue"
            options={openIssues.map((i) => ({
              value: i.id,
              label: [i.panelPoNo, i.processName, i.cuttingPoNo, i.jobWorkPoNo].filter(Boolean).join(' · '),
            }))}
            onChange={(id) => handleIssueSelect(id, issues)} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span style={{ color: 'var(--error-color)' }}>* </span>Vendor DC No.
          </div>
          <Input name="vendorDcNo" aria-label="Vendor DC No." aria-required="true" style={{ width: 180 }} maxLength={50}
            value={vendorDcNo} status={dcMissing && !vendorDcNo.trim() ? 'error' : undefined}
            onChange={(e) => setVendorDcNo(e.target.value)} placeholder="The vendor's challan" />
        </div>
      </Space>
      <Table rowKey="panelIssueLineId" size="small" columns={columns} dataSource={lines} pagination={false} scroll={{ x: 900 }}
        locale={{ emptyText: 'Partial receipts allowed — multiple vendor receipts can be raised against one issue' }} />
    </Drawer>
  );
};

export default ProcessReturnDrawer;
