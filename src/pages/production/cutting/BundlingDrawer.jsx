import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, InputNumber, Table, Alert, Descriptions } from 'antd';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { getCuttingReport, generateBundles, previewBundling } from '../../../services/production/cuttingService';

/**
 * FR-06 — split cut quantities into bundles. #Bundles = CEIL(cut / bundle size);
 * numbering continues across sizes. Blocked until the Cut PO's TMB checks pass.
 */
const BundlingDrawer = ({ open, cutPos, tmbChecks, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectCutPo, defaultCutPoId } = useModuleSelection('cutting');
  const [cutPoId, setCutPoId] = useState(null);
  const [bundleSize, setBundleSize] = useState(50);
  const [report, setReport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const { numericOptions } = useCuttingMasters();
  // Standard bundle sizes are a maintained list; anything else is entered as custom.
  const bundleSizes = useMemo(() => numericOptions('BUNDLE_SIZE').map((o) => o.value), [numericOptions]);

  useEffect(() => { if (open) setCutPoId(defaultCutPoId(cutPos)); }, [open, cutPos, defaultCutPoId]);

  useEffect(() => {
    if (!open || !cutPoId) { setReport(null); setPreview(null); return; }
    getCuttingReport(cutPoId).then(setReport).catch(() => {});
  }, [open, cutPoId]);

  // What is left to bundle is the server's arithmetic — cut less already bundled.
  useEffect(() => {
    if (!open || !cutPoId || !bundleSize) { setPreview(null); return; }
    previewBundling(cutPoId, bundleSize).then(setPreview).catch(() => setPreview(null));
  }, [open, cutPoId, bundleSize]);

  const tmbBlocked = useMemo(() => {
    if (!cutPoId) return false;
    const checks = tmbChecks.filter((t) => t.cuttingPoId === Number(cutPoId));
    return checks.length === 0 || checks.some((t) => t.status === 'PENDING' || t.status === 'FAILED');
  }, [tmbChecks, cutPoId]);

  const previewRows = useMemo(() => preview?.rows || [], [preview]);

  const handleGenerate = async () => {
    if (!previewRows.length) return message.warning('Nothing left to bundle for this Cut PO');
    setSaving(true);
    try {
      const run = await generateBundles({ cuttingPoId: cutPoId, bundleSize });
      message.success(`${run.bundlingNo}: ${run.totalBundles} bundles generated (${run.totalPcs} pcs)`);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to generate bundles');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Generate Bundles"
      size={560}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} disabled={tmbBlocked} onClick={handleGenerate}>Auto-Generate Bundles</Button>
        </Space>
      )}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Cut PO</div>
          <FormSelect value={cutPoId} style={{ width: '100%' }} placeholder="Select Cut PO"
            options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo} · ${p.color}` }))}
            onChange={(v) => { selectCutPo(cutPos.find((p) => p.id === v)); setCutPoId(v); }} />
        </div>
        {report && (
          <Descriptions size="small" column={2} bordered
            items={[
              { key: 'q', label: 'Order Qty', children: report.cutPo.orderQty },
              { key: 'c', label: 'Total Cut', children: report.totalCut },
              { key: 'b', label: 'Already Bundled', children: (report.totalCut || 0) - (preview?.totalPcs ?? 0) },
              { key: 'p', label: 'Pending to Bundle', children: preview?.totalPcs ?? 0 },
            ]} />
        )}
        {tmbBlocked && cutPoId && (
          <Alert type="error" showIcon title="Bundling blocked — TMB check missing, pending or failed"
            description="Every lay must pass its Top-Middle-Bottom check before its pieces can be bundled (BR-FR-06-07)." />
        )}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Bundle Size (pieces per bundle)</div>
          <Space>
            <FormSelect value={bundleSizes.includes(bundleSize) ? bundleSize : 'custom'} style={{ width: 140 }}
              options={[...bundleSizes.map((s) => ({ value: s, label: `${s} pcs` })), { value: 'custom', label: 'Custom' }]}
              onChange={(v) => setBundleSize(v === 'custom' ? 25 : v)} />
            {!bundleSizes.includes(bundleSize) && (
              <InputNumber min={5} max={200} value={bundleSize} onChange={(v) => setBundleSize(v || 25)} />
            )}
          </Space>
        </div>
        <Table rowKey="size" size="small" pagination={false} dataSource={previewRows}
          columns={[
            { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
            { title: 'Pieces to Bundle', dataIndex: 'qty', width: 130, align: 'right' },
            { title: '# Bundles', dataIndex: 'bundles', width: 100, align: 'right', render: (v) => <strong>{v}</strong> },
          ]}
          locale={{ emptyText: 'Select a Cut PO with un-bundled cut pieces' }}
          footer={() => `Bundle numbers continue sequentially across sizes; each bundle gets a QR ticket on save.`} />
      </Space>
    </Drawer>
  );
};

export default BundlingDrawer;
