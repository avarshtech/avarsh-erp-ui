import { useEffect, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, InputNumber, Table, Alert, Descriptions } from 'antd';
import { FormSelect } from '../../../components/form';
import { BUNDLE_SIZES } from '../../../utils/cuttingConstants';
import { getCuttingReport, generateBundles, listBundles } from '../../../services/production/cuttingService';

/**
 * FR-06 — split cut quantities into bundles. #Bundles = CEIL(cut / bundle size);
 * numbering continues across sizes. Blocked until the Cut PO's TMB checks pass.
 */
const BundlingDrawer = ({ open, cutPos, tmbChecks, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [cutPoId, setCutPoId] = useState(null);
  const [bundleSize, setBundleSize] = useState(50);
  const [report, setReport] = useState(null);
  const [alreadyBundled, setAlreadyBundled] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !cutPoId) { setReport(null); return; }
    Promise.all([getCuttingReport(cutPoId), listBundles(cutPoId)])
      .then(([rep, bundles]) => { setReport(rep); setAlreadyBundled(bundles.reduce((s, b) => s + b.qty, 0)); })
      .catch(() => {});
  }, [open, cutPoId]);

  const tmbBlocked = useMemo(() => {
    if (!cutPoId) return false;
    const checks = tmbChecks.filter((t) => t.cutPoId === Number(cutPoId));
    return checks.length === 0 || checks.some((t) => t.status === 'PENDING' || t.status === 'FAILED');
  }, [tmbChecks, cutPoId]);

  /** Un-bundled pieces per size = total cut − already bundled (proportionally simplified for the mock). */
  const pending = useMemo(() => {
    if (!report) return {};
    const totalCut = report.totalCut || 0;
    if (!totalCut || alreadyBundled >= totalCut) return {};
    const factor = (totalCut - alreadyBundled) / totalCut;
    return Object.fromEntries(report.cutPo.sizes
      .map((s) => [s, Math.round((report.cutBySize[s] || 0) * factor)])
      .filter(([, q]) => q > 0));
  }, [report, alreadyBundled]);

  const previewRows = useMemo(() => Object.entries(pending).map(([size, qty]) => ({
    size, qty, bundles: Math.ceil(qty / (bundleSize || 1)),
  })), [pending, bundleSize]);

  const handleGenerate = async () => {
    if (!previewRows.length) return message.warning('Nothing left to bundle for this Cut PO');
    setSaving(true);
    try {
      const created = await generateBundles({ cutPoId, bundleSize, cutBySize: pending });
      message.success(`${created.length} bundles generated (${created.reduce((s, b) => s + b.qty, 0)} pcs)`);
      onSaved();
    } catch { message.error('Failed to generate bundles'); } finally { setSaving(false); }
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
            onChange={setCutPoId} />
        </div>
        {report && (
          <Descriptions size="small" column={2} bordered
            items={[
              { key: 'q', label: 'Order Qty', children: report.cutPo.orderQty },
              { key: 'c', label: 'Total Cut', children: report.totalCut },
              { key: 'b', label: 'Already Bundled', children: alreadyBundled },
              { key: 'p', label: 'Pending to Bundle', children: Object.values(pending).reduce((s, v) => s + v, 0) },
            ]} />
        )}
        {tmbBlocked && cutPoId && (
          <Alert type="error" showIcon title="Bundling blocked — TMB check missing, pending or failed"
            description="Every lay must pass its Top-Middle-Bottom check before its pieces can be bundled (BR-FR-06-07)." />
        )}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Bundle Size (pieces per bundle)</div>
          <Space>
            <FormSelect value={BUNDLE_SIZES.includes(bundleSize) ? bundleSize : 'custom'} style={{ width: 140 }}
              options={[...BUNDLE_SIZES.map((s) => ({ value: s, label: `${s} pcs` })), { value: 'custom', label: 'Custom' }]}
              onChange={(v) => setBundleSize(v === 'custom' ? 25 : v)} />
            {!BUNDLE_SIZES.includes(bundleSize) && (
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
