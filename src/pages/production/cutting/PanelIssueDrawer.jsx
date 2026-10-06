import { useEffect, useState } from 'react';
import { App, Drawer, Button, Space, Tag } from 'antd';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { savePanelIssue } from '../../../services/production/cuttingService';
import PanelIssueFromPo from './PanelIssueFromPo';
import PanelIssueFreeText from './PanelIssueFreeText';

const EMPTY_PO = { jobWorkPoId: null, processId: null, qty: {} };
const EMPTY_FREE = { processId: null, lines: [] };

/**
 * FR-08 — send cut panels out for printing / embroidery / washing with a DC. An in-house Cut PO issues against
 * an approved Cut Panel PO for its order, which fixes the process, job worker and dates (D4); an outsourced one
 * keeps the free-text issue.
 */
const PanelIssueDrawer = ({ open, cutPos, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { selectCutPo, defaultCutPoId } = useModuleSelection('cutting');
  const [cutPoId, setCutPoId] = useState(null);
  const [fromPo, setFromPo] = useState(EMPTY_PO);
  const [free, setFree] = useState(EMPTY_FREE);
  const [saving, setSaving] = useState(false);
  // Every opening starts clean: a PO picked or quantities typed before a Cancel are not carried over
  useEffect(() => {
    if (!open) return;
    setCutPoId(defaultCutPoId(cutPos));
    setFromPo(EMPTY_PO);
    setFree(EMPTY_FREE);
  }, [open, cutPos, defaultCutPoId]);

  const po = cutPos.find((p) => p.id === cutPoId);
  const inHouse = po?.processingUnitType === 'UNIT';
  const total = inHouse
    ? Object.values(fromPo.qty).reduce((s, q) => s + (q || 0), 0)
    : free.lines.reduce((s, l) => s + (l.issueQty || 0), 0);

  const body = () => {
    if (inHouse) {
      const lines = Object.entries(fromPo.qty).filter(([, q]) => q > 0).map(([id, q]) => ({ jobWorkPoLineId: Number(id), issueQty: q }));
      if (!fromPo.jobWorkPoId) return 'Pick the approved Cut Panel PO these panels go out against';
      return lines.length ? { jobWorkPoId: fromPo.jobWorkPoId, processId: fromPo.processId, lines } : 'Enter the quantity to send on at least one line';
    }
    const lines = free.lines.filter((l) => l.panel && l.size && l.issueQty > 0);
    if (!free.processId) return 'Select the external process';
    return lines.length ? { processId: free.processId, lines } : 'Add at least one panel line with quantity';
  };

  const handleSave = async () => {
    if (!cutPoId) return message.warning('Select the Cut PO');
    const ready = body();
    if (typeof ready === 'string') return message.warning(ready);
    setSaving(true);
    try {
      const saved = await savePanelIssue({ cuttingPoId: cutPoId, issueDate: new Date().toISOString().slice(0, 10), ...ready });
      message.success(`${saved.panelPoNo} issued to ${saved.processName} — DC ready to print`);
      setFromPo(EMPTY_PO); setFree(EMPTY_FREE);
      onSaved();
    } catch {
      // the API's own message has been shown
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Issue Cut Panels to External Process" size={inHouse ? 860 : 620} open={open} onClose={onClose} destroyOnHidden
      footer={(
        <Space style={{ float: 'right' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total: <strong>{total}</strong> pcs</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>Save &amp; Print DC</Button>
        </Space>
      )}
    >
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect value={cutPoId} style={{ width: 230 }} placeholder="Cut PO" aria-label="Cut PO"
          options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
          onChange={(v) => {
            selectCutPo(cutPos.find((p) => p.id === v));
            setCutPoId(v);
            setFromPo(EMPTY_PO); setFree(EMPTY_FREE);
          }} />
        {po && <Tag color={inHouse ? 'blue' : 'orange'}>{inHouse ? 'In-house — against a Cut Panel PO' : 'Outsourced unit'}</Tag>}
      </Space>
      {po && (inHouse
        ? <PanelIssueFromPo key={po.id} cutPo={po} value={fromPo} onChange={setFromPo} />
        : <PanelIssueFreeText key={po.id} po={po} value={free} onChange={setFree} />)}
    </Drawer>
  );
};

export default PanelIssueDrawer;
