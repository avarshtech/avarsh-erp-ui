import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Alert, Modal, InputNumber, Input, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { FormSelect } from '../../../components/form';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { getTablePagination } from '../../../utils/paginationConfig';
import { SEWING_LINES } from '../../../utils/cuttingConstants';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { formatNumber } from '../../../utils/formatters';
import { getActiveParts } from '../../../services/master/partsService';
import { listReCutEntries, addReCutEntry, getCutPos, getRolls } from '../../../services/production/cuttingService';

const EMPTY_DRAFT = { entryDate: null, cuttingPoId: null, lineName: null, part: null, stNo: '', rollNo: null, qty: null, monitor: '', reason: null, qcSign: '' };

/** FR-11 — chronological re-cut register with reason tracking and a >2% alert. */
const ReCutRegisterTab = () => {
  const { message } = App.useApp();
  const { selectCutPo } = useModuleSelection('cutting');
  const [entries, setEntries] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lineFilter, setLineFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const { options, threshold, labelOf } = useCuttingMasters();
  const reasonOptions = options('RECUT_REASON');
  const reCutAlertPct = threshold('RECUT_ALERT_PCT', 2);
  const [parts, setParts] = useState([]);
  useEffect(() => { getActiveParts().then(setParts).catch(() => setParts([])); }, []);
  const partOptions = useMemo(() => parts.map((p) => ({ value: p.name, label: p.name })), [parts]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, pos] = await Promise.all([listReCutEntries(), getCutPos()]);
      setEntries(rows); setCutPos(pos);
    } catch { message.error('Failed to load re-cut register'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draft.cuttingPoId) return;
    getRolls(draft.cuttingPoId).then(setRolls).catch(() => {});
  }, [draft.cuttingPoId]);

  const filtered = useMemo(() => entries.filter((e) => !lineFilter || e.lineName === lineFilter), [entries, lineFilter]);

  const reCutStats = useMemo(() => {
    const totalOrder = cutPos.reduce((s, p) => s + p.orderQty, 0);
    const totalReCut = entries.reduce((s, e) => s + e.qty, 0);
    return { totalReCut, pct: totalOrder ? Math.round((totalReCut / totalOrder) * 1000) / 10 : 0 };
  }, [entries, cutPos]);

  const columns = useMemo(() => [
    { title: 'Date', dataIndex: 'entryDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY'), sorter: (a, b) => a.entryDate.localeCompare(b.entryDate), defaultSortOrder: 'descend' },
    { title: 'Cut PO', dataIndex: 'cuttingPoNo', width: 145 },
    { title: 'Line', dataIndex: 'lineName', width: 90, align: 'center' },
    { title: 'Part', dataIndex: 'part', width: 100 },
    { title: 'ST. No', dataIndex: 'stNo', width: 120, render: (v) => <code>{v}</code> },
    { title: 'Roll No', dataIndex: 'rollNo', width: 90, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'D/Cut Qty', dataIndex: 'qty', width: 90, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Monitor', dataIndex: 'monitor', width: 110 },
    { title: 'Reason', dataIndex: 'reason', width: 150, render: (v) => labelOf('RECUT_REASON', v) },
    { title: 'Fabric', dataIndex: 'fabricKg', width: 110, align: 'right', render: (v) => formatNumber(v, 3) },
    { title: 'QC Sign', dataIndex: 'qcSign', width: 110, render: (v) => v || <span style={{ color: 'var(--warning-color)' }}>Pending</span> },
  ], [labelOf]);

  const handleAdd = async () => {
    if (!draft.cuttingPoId || !draft.lineName || !draft.part || !draft.rollNo || !draft.qty) {
      return message.warning('Cut PO, line, part, roll and quantity are required');
    }
    if (!draft.reason) return message.warning('Every re-cut needs a reason for root-cause analysis');
    await addReCutEntry({ ...draft, entryDate: (draft.entryDate || dayjs()).format('YYYY-MM-DD') });
    message.success('Re-cut entry recorded — fabric consumption updated');
    setModalOpen(false); setDraft(EMPTY_DRAFT);
    load();
  };

  return (
    <Card>
      {reCutStats.pct > reCutAlertPct && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Re-cut rate ${reCutStats.pct}% exceeds the ${reCutAlertPct}% threshold — Production Manager alerted (BR-FR-11-07)`} />
      )}
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space size="middle">
          <FormSelect value={lineFilter} style={{ width: 140 }} placeholder="All lines" allowClear
            options={SEWING_LINES.map((l) => ({ value: l, label: l }))} onChange={setLineFilter} />
          <span style={{ color: 'var(--text-secondary)' }}>
            Total re-cut: <strong>{reCutStats.totalReCut} pcs</strong> ({reCutStats.pct}% of order qty)
          </span>
        </Space>
        <ActionButton action="create" text="Add Re-Cut Entry" onClick={() => { setDraft({ ...EMPTY_DRAFT, entryDate: dayjs() }); setModalOpen(true); }} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={filtered} loading={loading}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 15 }, 'entries')}
        locale={{ emptyText: <EmptyState title="No re-cut entries" description="Log defective pieces reported from TMB, bundling or sewing lines" /> }} />
      <Modal title="Add Re-Cut Entry" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleAdd} okText="Add Entry" destroyOnHidden>
        <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
          <Space size="middle" wrap>
            <DatePicker size="small" format="DD-MMM-YYYY" value={draft.entryDate} allowClear={false} onChange={(d) => setDraft((x) => ({ ...x, entryDate: d }))} />
            <FormSelect size="small" value={draft.cuttingPoId} style={{ width: 210 }} placeholder="Cut PO"
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => {
                selectCutPo(cutPos.find((p) => p.id === v));
                setDraft((x) => ({ ...x, cuttingPoId: v, rollNo: null }));
              }} />
            <FormSelect size="small" value={draft.lineName} style={{ width: 110 }} placeholder="Line"
              options={SEWING_LINES.map((l) => ({ value: l, label: l }))} onChange={(v) => setDraft((x) => ({ ...x, lineName: v }))} />
            <FormSelect size="small" value={draft.part} style={{ width: 120 }} placeholder="Part"
              options={partOptions} onChange={(v) => setDraft((x) => ({ ...x, part: v }))} />
          </Space>
          <Space size="middle" wrap>
            <Input size="small" value={draft.stNo} style={{ width: 140 }} placeholder="ST. No (bundle/serial)" onChange={(e) => setDraft((x) => ({ ...x, stNo: e.target.value }))} />
            <FormSelect size="small" value={draft.rollNo} style={{ width: 160 }} placeholder="Roll (relaxed)"
              options={rolls.filter((r) => r.relaxed).map((r) => ({ value: r.rollNo, label: `${r.rollNo} · ${r.shadeLot}` }))}
              onChange={(v) => setDraft((x) => ({ ...x, rollNo: v }))} />
            <InputNumber size="small" min={1} value={draft.qty} style={{ width: 110 }} placeholder="Qty" onChange={(v) => setDraft((x) => ({ ...x, qty: v }))} />
          </Space>
          <Space size="middle" wrap>
            <FormSelect size="small" value={draft.reason} style={{ width: 190 }} placeholder="Reason"
              options={reasonOptions} onChange={(v) => setDraft((x) => ({ ...x, reason: v }))} />
            <Input size="small" value={draft.monitor} style={{ width: 150 }} placeholder="Monitor / supervisor" onChange={(e) => setDraft((x) => ({ ...x, monitor: e.target.value }))} />
            <Input size="small" value={draft.qcSign} style={{ width: 130 }} placeholder="QC sign" onChange={(e) => setDraft((x) => ({ ...x, qcSign: e.target.value }))} />
          </Space>
        </Space>
      </Modal>
    </Card>
  );
};

export default ReCutRegisterTab;
