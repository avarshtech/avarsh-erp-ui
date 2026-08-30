import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Alert, Modal, InputNumber, Input, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { FormSelect } from '../../../components/form';
import { getTablePagination } from '../../../utils/paginationConfig';
import { SEWING_LINES, PANEL_NAMES, RECUT_REASONS, THRESHOLDS } from '../../../utils/cuttingConstants';
import { listReCutEntries, addReCutEntry, getCutPos, getRolls } from '../../../services/production/cuttingService';

const EMPTY_DRAFT = { date: null, cutPoId: null, line: null, part: null, stNo: '', rollNo: null, qty: null, monitor: '', remark: null, qcSign: '' };

/** FR-11 — chronological re-cut register with reason tracking and a >2% alert. */
const ReCutRegisterTab = () => {
  const { message } = App.useApp();
  const [entries, setEntries] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lineFilter, setLineFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, pos] = await Promise.all([listReCutEntries(), getCutPos()]);
      setEntries(rows); setCutPos(pos);
    } catch { message.error('Failed to load re-cut register'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draft.cutPoId) return;
    getRolls(draft.cutPoId).then(setRolls).catch(() => {});
  }, [draft.cutPoId]);

  const filtered = useMemo(() => entries.filter((e) => !lineFilter || e.line === lineFilter), [entries, lineFilter]);

  const reCutStats = useMemo(() => {
    const totalOrder = cutPos.reduce((s, p) => s + p.orderQty, 0);
    const totalReCut = entries.reduce((s, e) => s + e.qty, 0);
    return { totalReCut, pct: totalOrder ? Math.round((totalReCut / totalOrder) * 1000) / 10 : 0 };
  }, [entries, cutPos]);

  const columns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY'), sorter: (a, b) => a.date.localeCompare(b.date), defaultSortOrder: 'descend' },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 145, render: (v) => cutPos.find((p) => p.id === v)?.cutPoNo || '—' },
    { title: 'Line', dataIndex: 'line', width: 90, align: 'center' },
    { title: 'Part', dataIndex: 'part', width: 100 },
    { title: 'ST. No', dataIndex: 'stNo', width: 120, render: (v) => <code>{v}</code> },
    { title: 'Roll No', dataIndex: 'rollNo', width: 90, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'D/Cut Qty', dataIndex: 'qty', width: 90, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Monitor', dataIndex: 'monitor', width: 110 },
    { title: 'Remark', dataIndex: 'remark', width: 140 },
    { title: 'QC Sign', dataIndex: 'qcSign', width: 110, render: (v) => v || <span style={{ color: 'var(--warning-color)' }}>Pending</span> },
  ], [cutPos]);

  const handleAdd = async () => {
    if (!draft.cutPoId || !draft.line || !draft.part || !draft.rollNo || !draft.qty) {
      return message.warning('Cut PO, line, part, roll and quantity are required');
    }
    if (!draft.remark) return message.warning('Every re-cut needs a reason for root-cause analysis');
    await addReCutEntry({ ...draft, date: (draft.date || dayjs()).format('YYYY-MM-DD') });
    message.success('Re-cut entry recorded — fabric consumption updated');
    setModalOpen(false); setDraft(EMPTY_DRAFT);
    load();
  };

  return (
    <Card>
      {reCutStats.pct > THRESHOLDS.reCutAlertPct && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Re-cut rate ${reCutStats.pct}% exceeds the ${THRESHOLDS.reCutAlertPct}% threshold — Production Manager alerted (BR-FR-11-07)`} />
      )}
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space size="middle">
          <FormSelect value={lineFilter} style={{ width: 140 }} placeholder="All lines" allowClear
            options={SEWING_LINES.map((l) => ({ value: l, label: l }))} onChange={setLineFilter} />
          <span style={{ color: 'var(--text-secondary)' }}>
            Total re-cut: <strong>{reCutStats.totalReCut} pcs</strong> ({reCutStats.pct}% of order qty)
          </span>
        </Space>
        <ActionButton action="create" text="Add Re-Cut Entry" onClick={() => { setDraft({ ...EMPTY_DRAFT, date: dayjs() }); setModalOpen(true); }} />
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={filtered} loading={loading}
        scroll={{ x: 1100 }} pagination={getTablePagination({ pageSize: 15 }, 'entries')}
        locale={{ emptyText: <EmptyState title="No re-cut entries" description="Log defective pieces reported from TMB, bundling or sewing lines" /> }} />
      <Modal title="Add Re-Cut Entry" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleAdd} okText="Add Entry" destroyOnHidden>
        <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
          <Space size="middle" wrap>
            <DatePicker size="small" format="DD-MMM-YYYY" value={draft.date} allowClear={false} onChange={(d) => setDraft((x) => ({ ...x, date: d }))} />
            <FormSelect size="small" value={draft.cutPoId} style={{ width: 210 }} placeholder="Cut PO"
              options={cutPos.map((p) => ({ value: p.id, label: `${p.cutPoNo} · ${p.styleNo}` }))}
              onChange={(v) => setDraft((x) => ({ ...x, cutPoId: v, rollNo: null }))} />
            <FormSelect size="small" value={draft.line} style={{ width: 110 }} placeholder="Line"
              options={SEWING_LINES.map((l) => ({ value: l, label: l }))} onChange={(v) => setDraft((x) => ({ ...x, line: v }))} />
            <FormSelect size="small" value={draft.part} style={{ width: 120 }} placeholder="Part"
              options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} onChange={(v) => setDraft((x) => ({ ...x, part: v }))} />
          </Space>
          <Space size="middle" wrap>
            <Input size="small" value={draft.stNo} style={{ width: 140 }} placeholder="ST. No (bundle/serial)" onChange={(e) => setDraft((x) => ({ ...x, stNo: e.target.value }))} />
            <FormSelect size="small" value={draft.rollNo} style={{ width: 160 }} placeholder="Roll (relaxed)"
              options={rolls.filter((r) => r.relaxed).map((r) => ({ value: r.rollNo, label: `${r.rollNo} · ${r.shadeLot}` }))}
              onChange={(v) => setDraft((x) => ({ ...x, rollNo: v }))} />
            <InputNumber size="small" min={1} value={draft.qty} style={{ width: 110 }} placeholder="Qty" onChange={(v) => setDraft((x) => ({ ...x, qty: v }))} />
          </Space>
          <Space size="middle" wrap>
            <FormSelect size="small" value={draft.remark} style={{ width: 180 }} placeholder="Reason"
              options={RECUT_REASONS.map((r) => ({ value: r, label: r }))} onChange={(v) => setDraft((x) => ({ ...x, remark: v }))} />
            <Input size="small" value={draft.monitor} style={{ width: 150 }} placeholder="Monitor / supervisor" onChange={(e) => setDraft((x) => ({ ...x, monitor: e.target.value }))} />
            <Input size="small" value={draft.qcSign} style={{ width: 130 }} placeholder="QC sign" onChange={(e) => setDraft((x) => ({ ...x, qcSign: e.target.value }))} />
          </Space>
        </Space>
      </Modal>
    </Card>
  );
};

export default ReCutRegisterTab;
