import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input, Alert, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { saveCutReceipt, listPendingBundleIssues } from '../../../services/production/sewingService';

/**
 * PRD 4.2 — receive a Cutting Bundle Issue onto a sewing line; verify per-bundle
 * qty. The order is not chosen here: it comes with the issue, so bundles cannot
 * be received against the wrong one.
 */
const CutPartsReceiptDrawer = ({ open, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { lines: allLines, linesByFactory, options, threshold } = useSewingMasters();
  const [issues, setIssues] = useState([]);
  const [issueId, setIssueId] = useState(null);
  const [lineId, setLineId] = useState(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const discrepancyLimit = threshold('RECEIPT_DISCREPANCY_PCT', 2);
  const qualityOptions = options('BUNDLE_QUALITY');

  useEffect(() => {
    if (!open) return;
    listPendingBundleIssues()
      .then(setIssues)
      .catch(() => message.error('Failed to load bundle issues from cutting'));
  }, [open, message]);

  const issue = useMemo(() => issues.find((i) => i.id === issueId), [issues, issueId]);

  // The unit is read through the chosen line, so the two selects cannot disagree.
  const unitId = useMemo(() => allLines.find((l) => l.id === lineId)?.factoryId ?? null, [allLines, lineId]);
  const unitOptions = useMemo(() => {
    const seen = new Map();
    allLines.forEach((l) => seen.set(l.factoryId, l.factoryName));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [allLines]);
  const lineOptions = useMemo(
    () => linesByFactory(unitId).map((l) => ({ value: l.id, label: l.name })),
    [linesByFactory, unitId],
  );

  /** Selecting an issue loads its bundles, pre-filled with what cutting sent. */
  const handleIssueSelect = useCallback((id) => {
    setIssueId(id);
    setRows((issues.find((i) => i.id === id)?.bundles || []).map((b) => ({ ...b })));
  }, [issues]);

  const setRow = useCallback((idx, field, val) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }, []);

  const expected = rows.reduce((s, r) => s + (r.expectedQty || 0), 0);
  const received = rows.reduce((s, r) => s + (r.receivedQty || 0), 0);
  const discrepancyPct = expected ? Math.round(Math.abs(expected - received) / expected * 1000) / 10 : 0;
  const flagged = discrepancyPct > discrepancyLimit;

  const columns = useMemo(() => [
    { title: 'Bundle', dataIndex: 'bundleNo', width: 90, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Serials', dataIndex: 'serialRange', width: 100, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'Expected', dataIndex: 'expectedQty', width: 90, align: 'right' },
    {
      title: 'Received Qty', dataIndex: 'receivedQty', width: 110, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} value={v} style={{ width: 90 }}
          status={v !== r.expectedQty ? 'warning' : undefined} onChange={(val) => setRow(idx, 'receivedQty', val)} />
      ),
    },
    {
      title: 'Quality', dataIndex: 'quality', width: 140,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 125 }}
          options={qualityOptions} onChange={(val) => setRow(idx, 'quality', val)} />
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 180,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setRow(idx, 'remarks', e.target.value)} />,
    },
  ], [setRow, qualityOptions]);

  const handleSave = async () => {
    if (!issue) return message.warning('Select the Bundle Issue from cutting');
    if (!lineId) return message.warning('Select the sewing line receiving these bundles');
    setSaving(true);
    try {
      const saved = await saveCutReceipt({
        bundleIssueId: issue.id,
        lineId,
        receiptDate: dayjs().format('YYYY-MM-DD'),
        receivedBy: receivedBy || null,
        bundles: rows.map((r) => ({
          bundleId: r.bundleId,
          receivedQty: r.receivedQty || 0,
          quality: r.quality,
          remarks: r.remarks,
        })),
      });
      message.success(saved.status === 'DISCREPANCY'
        ? `${saved.receiptNo} saved with DISCREPANCY flag (${saved.discrepancyPct}%)`
        : `${saved.receiptNo}: bundles received and verified`);
      setRows([]); setIssueId(null); setReceivedBy('');
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save receipt');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Receive Cut Parts from Cutting"
      size={760}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Received <strong>{received}</strong> / expected <strong>{expected}</strong></span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Confirm Receipt</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={issueId} style={{ width: 320 }} placeholder="Bundle Issue note from Cutting"
          options={issues.map((i) => ({ value: i.id, label: `${i.issueNo} · ${i.totalPcs} pcs · ${i.orderNo || 'no order'}` }))}
          onChange={handleIssueSelect} />
        <FormSelect value={unitId} style={{ width: 200 }} placeholder="Unit"
          options={unitOptions} onChange={(v) => setLineId(linesByFactory(v)[0]?.id ?? null)} />
        <FormSelect value={lineId} style={{ width: 140 }} placeholder="Line"
          options={lineOptions} onChange={setLineId} />
        <Input style={{ width: 180 }} placeholder="Received by" value={receivedBy}
          onChange={(e) => setReceivedBy(e.target.value)} />
      </Space>
      {issue && (
        <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginBottom: 12 }}
          items={[
            { key: 'o', label: 'Order', children: issue.orderNo || '—' },
            { key: 's', label: 'Style', children: issue.styleNo || '—' },
            { key: 'c', label: 'Cut PO', children: issue.cuttingPoNo || '—' },
            { key: 'w', label: 'Work Order', children: issue.workOrderNo || '—' },
          ]} />
      )}
      {issues.length === 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          title="No bundle issues are awaiting receipt"
          description="Cutting has not issued any bundles that sewing has yet to take in." />
      )}
      {flagged && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }}
          title={`Quantity differs by ${discrepancyPct}% (> ${discrepancyLimit}%) — receipt will be flagged as DISCREPANCY`} />
      )}
      <Table rowKey={(r) => r.bundleId ?? r.bundleNo} size="small" columns={columns} dataSource={rows} pagination={false}
        locale={{ emptyText: 'Select a bundle issue note to load its bundles' }} />
    </Drawer>
  );
};

export default CutPartsReceiptDrawer;
