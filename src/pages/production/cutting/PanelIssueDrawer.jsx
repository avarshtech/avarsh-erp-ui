import { useCallback, useMemo, useState } from 'react';
import { App, Drawer, Button, Space, Table, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { EXTERNAL_PROCESSES, PANEL_NAMES } from '../../../utils/cuttingConstants';
import { savePanelIssue } from '../../../services/production/cuttingService';

/** FR-08 — send cut panels out for printing / embroidery / washing with a DC. */
const PanelIssueDrawer = ({ open, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [cutPoId, setCutPoId] = useState(null);
  const [process, setProcess] = useState(null);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const po = useMemo(() => cutPos.find((p) => p.id === cutPoId), [cutPos, cutPoId]);

  const setLine = useCallback((idx, field, val) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, [field]: val };
      if (field === 'size' && po) next.ordQty = po.sizeQty[val] || 0;
      return next;
    }));
  }, [po]);

  const columns = useMemo(() => [
    {
      title: 'Panel', dataIndex: 'panel', width: 130,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 115 }} placeholder="Panel"
          options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} onChange={(val) => setLine(idx, 'panel', val)} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', width: 100,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 84 }} placeholder="Size"
          options={(po?.sizes || []).map((s) => ({ value: s, label: s }))} onChange={(val) => setLine(idx, 'size', val)} />
      ),
    },
    { title: 'Ord Qty', dataIndex: 'ordQty', width: 90, align: 'right', render: (v) => v ?? '—' },
    {
      title: 'Issue Qty', dataIndex: 'issueQty', width: 110, align: 'center',
      render: (v, r, idx) => (
        <InputNumber size="small" min={0} max={r.ordQty || undefined} value={v} style={{ width: 90 }}
          status={v > (r.ordQty || Infinity) ? 'error' : undefined} onChange={(val) => setLine(idx, 'issueQty', val)} />
      ),
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} />
      ),
    },
  ], [po, setLine]);

  const total = lines.reduce((s, l) => s + (l.issueQty || 0), 0);

  const handleSave = async () => {
    if (!cutPoId || !process) return message.warning('Select the Cut PO and the external process');
    const valid = lines.filter((l) => l.panel && l.size && l.issueQty > 0);
    if (!valid.length) return message.warning('Add at least one panel line with quantity');
    setSaving(true);
    try {
      const saved = await savePanelIssue({ cutPoId, process, date: new Date().toISOString().slice(0, 10), lines: valid });
      message.success(`${saved.panelPoNo} issued to ${process} — DC ready to print`);
      setLines([]); setProcess(null);
      onSaved();
    } catch { message.error('Failed to issue panels'); } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Issue Cut Panels to External Process"
      size={620}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total: <strong>{total}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save &amp; Print DC</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={cutPoId} style={{ width: 230 }} placeholder="Cut PO"
          options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
          onChange={(v) => { setCutPoId(v); setLines([]); }} />
        <FormSelect value={process} style={{ width: 160 }} placeholder="Process"
          options={EXTERNAL_PROCESSES.map((p) => ({ value: p, label: p }))} onChange={setProcess} />
        <Button icon={<PlusOutlined />} size="small" disabled={!cutPoId}
          onClick={() => setLines((prev) => [...prev, { panel: null, size: null, ordQty: null, issueQty: null }])}>
          Add Panel
        </Button>
      </Space>
      <Table rowKey={(r) => lines.indexOf(r)} size="small" columns={columns} dataSource={lines} pagination={false}
        locale={{ emptyText: 'Issued panels are excluded from bundling until they return and pass the panel check' }} />
    </Drawer>
  );
};

export default PanelIssueDrawer;
