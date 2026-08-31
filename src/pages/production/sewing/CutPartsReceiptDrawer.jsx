import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber, Input, Alert } from 'antd';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { UNITS, LINES_BY_UNIT, RECEIPT_DISCREPANCY_PCT } from '../../../utils/sewingConstants';
import { saveCutReceipt, listCuttingBundleIssues, listCuttingBundles } from '../../../services/production/sewingService';

/** PRD 4.2 — receive a Cutting Bundle Issue onto a sewing line; verify per-bundle qty. */
const CutPartsReceiptDrawer = ({ open, orders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [issues, setIssues] = useState([]);
  const [allBundles, setAllBundles] = useState([]);
  const [issueId, setIssueId] = useState(null);
  const [unit, setUnit] = useState(UNITS[0]);
  const [line, setLine] = useState(LINES_BY_UNIT[UNITS[0]][0]);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([listCuttingBundleIssues(), listCuttingBundles()])
      .then(([iss, bundles]) => { setIssues(iss); setAllBundles(bundles); })
      .catch(() => {});
  }, [open]);

  const issue = useMemo(() => issues.find((i) => i.id === issueId), [issues, issueId]);

  const handleIssueSelect = useCallback((id, issueList, bundles) => {
    setIssueId(id);
    const src = issueList.find((i) => i.id === id);
    setRows((src?.bundleIds || []).map((bid) => {
      const b = bundles.find((x) => x.id === bid);
      return {
        bundleNo: `B-${b?.bundleNo}`, size: b?.size, serialRange: b?.range,
        expectedQty: b?.qty || 0, qty: b?.qty || 0, quality: 'OK', remarks: '',
      };
    }));
  }, []);

  const setRow = useCallback((idx, field, val) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }, []);

  const expected = rows.reduce((s, r) => s + r.expectedQty, 0);
  const received = rows.reduce((s, r) => s + (r.qty || 0), 0);
  const discrepancyPct = expected ? Math.round(Math.abs(expected - received) / expected * 1000) / 10 : 0;
  const flagged = discrepancyPct > RECEIPT_DISCREPANCY_PCT;

  const columns = useMemo(() => [
    { title: 'Bundle', dataIndex: 'bundleNo', width: 90, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Serials', dataIndex: 'serialRange', width: 100, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'Expected', dataIndex: 'expectedQty', width: 90, align: 'right' },
    {
      title: 'Received Qty', dataIndex: 'qty', width: 110, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} value={v} style={{ width: 90 }}
          status={v !== r.expectedQty ? 'warning' : undefined} onChange={(val) => setRow(idx, 'qty', val)} />
      ),
    },
    {
      title: 'Quality', dataIndex: 'quality', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }}
          options={['OK', 'DEFECTIVE', 'SHORTAGE'].map((q) => ({ value: q, label: q }))}
          onChange={(val) => setRow(idx, 'quality', val)} />
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 180,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setRow(idx, 'remarks', e.target.value)} />,
    },
  ], [setRow]);

  const handleSave = async () => {
    if (!issue) return message.warning('Select the Bundle Issue from cutting');
    setSaving(true);
    try {
      const orderId = orders.find((o) => o.orderNo === 'SG/26-27/1001')?.id ?? orders[0]?.id;
      await saveCutReceipt({
        orderId, unit, line, bundleIssueNo: issue.issueNo, date: dayjs().format('YYYY-MM-DD'),
        receivedBy: 'Line Supervisor', status: flagged ? 'DISCREPANCY' : 'VERIFIED',
        bundles: rows.map(({ expectedQty, ...r }) => ({ ...r, qty: r.qty || 0, expectedQty })),
      });
      message.success(flagged ? 'Receipt saved with DISCREPANCY flag' : 'Bundles received and verified');
      setRows([]); setIssueId(null);
      onSaved();
    } catch { message.error('Failed to save receipt'); } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Receive Cut Parts from Cutting"
      size={720}
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
        <FormSelect value={issueId} style={{ width: 300 }} placeholder="Bundle Issue note from Cutting"
          options={issues.map((i) => ({ value: i.id, label: `${i.issueNo} · ${i.workOrderNo} · ${i.totalPcs} pcs` }))}
          onChange={(id) => handleIssueSelect(id, issues, allBundles)} />
        <FormSelect value={unit} style={{ width: 160 }}
          options={UNITS.map((u) => ({ value: u, label: u }))}
          onChange={(v) => { setUnit(v); setLine(LINES_BY_UNIT[v][0]); }} />
        <FormSelect value={line} style={{ width: 120 }}
          options={(LINES_BY_UNIT[unit] || []).map((l) => ({ value: l, label: l }))} onChange={setLine} />
      </Space>
      {flagged && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }}
          title={`Quantity differs by ${discrepancyPct}% (> ${RECEIPT_DISCREPANCY_PCT}%) — receipt will be flagged as DISCREPANCY`} />
      )}
      <Table rowKey="bundleNo" size="small" columns={columns} dataSource={rows} pagination={false}
        locale={{ emptyText: 'Select a bundle issue note to load its bundles' }} />
    </Drawer>
  );
};

export default CutPartsReceiptDrawer;
