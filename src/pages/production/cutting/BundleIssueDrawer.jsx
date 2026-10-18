import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table } from 'antd';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { issueBundles } from '../../../services/production/cuttingService';
import { getApprovedWorkOrders } from '../../../services/po/production/workOrderService';

/**
 * FR-07 — hand bundled cut parts over to a sewing line (partial issue allowed), on the approved Work
 * Order raised on the Cut PO; the server refuses any other.
 */
const BundleIssueDrawer = ({ open, cutPos, bundles, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectCutPo, defaultCutPoId } = useModuleSelection('cutting');
  const [cutPoId, setCutPoId] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderNo, setWorkOrderNo] = useState(null);
  const [sizeFilter, setSizeFilter] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setCutPoId(defaultCutPoId(cutPos)); }, [open, cutPos, defaultCutPoId]);

  // The Cut PO's approved Work Orders; the only one is picked for the cutter
  const orderId = useMemo(() => cutPos.find((p) => p.id === Number(cutPoId))?.orderId, [cutPos, cutPoId]);
  useEffect(() => {
    setWorkOrderNo(null);
    if (!open || !orderId) { setWorkOrders([]); return; }
    let live = true;
    getApprovedWorkOrders(orderId)
      .then((list) => {
        if (!live) return;
        const mine = list.filter((wo) => wo.cuttingPoId === Number(cutPoId));
        setWorkOrders(mine);
        if (mine.length === 1) setWorkOrderNo(mine[0].workOrderNo);
      })
      .catch(() => { if (live) setWorkOrders([]); });
    return () => { live = false; };
  }, [open, orderId, cutPoId]);

  const available = useMemo(() => bundles.filter((b) => b.status === 'BUNDLED'
    && (!cutPoId || b.cuttingPoId === Number(cutPoId))
    && (!sizeFilter || b.size === sizeFilter)), [bundles, cutPoId, sizeFilter]);

  const sizes = useMemo(() => [...new Set(bundles.filter((b) => !cutPoId || b.cuttingPoId === Number(cutPoId)).map((b) => b.size))], [bundles, cutPoId]);
  const selected = useMemo(() => bundles.filter((b) => selectedIds.includes(b.id)), [bundles, selectedIds]);

  const handleIssue = async () => {
    if (!cutPoId) return message.warning('Select the Cut PO');
    if (!workOrderNo) return message.warning('Select the Work Order the bundles are sewn on');
    if (!selectedIds.length) return message.warning('Select at least one bundle');
    setSaving(true);
    try {
      const issue = await issueBundles({ cuttingPoId: cutPoId, workOrderNo, bundleIds: selectedIds });
      message.success(`${issue.issueNo}: ${issue.totalPcs} pcs issued to ${workOrderNo}`);
      setSelectedIds([]);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to issue bundles');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Issue Bundles to Sewing"
      size={640}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {selected.length} bundle(s) · {selected.reduce((s, b) => s + b.qty, 0)} pcs
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleIssue}>Issue &amp; Print Note</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={cutPoId} style={{ width: 220 }} placeholder="Cut PO"
          options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
          onChange={(v) => {
            selectCutPo(cutPos.find((p) => p.id === v));
            setCutPoId(v);
            setSelectedIds([]);
          }} />
        <FormSelect value={workOrderNo} style={{ width: 190 }} placeholder="Work Order #"
          notFoundContent={cutPoId ? 'No approved Work Order on this Cut PO yet' : 'Select the Cut PO first'}
          options={workOrders.map((wo) => ({ value: wo.workOrderNo, label: wo.workOrderNo }))} onChange={setWorkOrderNo} />
        <FormSelect value={sizeFilter} style={{ width: 130 }} placeholder="All sizes" allowClear
          options={sizes.map((s) => ({ value: s, label: `Size ${s}` }))} onChange={setSizeFilter} />
      </Space>
      <Table
        rowKey="id" size="small" pagination={false} dataSource={available}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds }}
        columns={[
          { title: 'Bundle #', dataIndex: 'bundleNo', width: 90, align: 'center', render: (v) => <strong>B-{v}</strong> },
          { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
          { title: 'Pieces', dataIndex: 'qty', width: 80, align: 'center' },
          { title: 'Serial Range', dataIndex: 'range', width: 120, align: 'center', render: (v) => <code>{v}</code> },
        ]}
        locale={{ emptyText: 'No bundles in BUNDLED status for this selection' }}
      />
    </Drawer>
  );
};

export default BundleIssueDrawer;
