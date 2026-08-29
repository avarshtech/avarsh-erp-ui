import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Button, Modal, InputNumber, Space, Tag, DatePicker, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { CUTTING_BY_OPTIONS } from '../../../utils/cuttingConstants';
import { addReportLay, listMarkersForPo, listLayAudits } from '../../../services/production/cuttingService';

/**
 * FR-05 pivot — rows are lays, columns are sizes. Recording a lay now starts
 * from Marker # + Lay # (from lay audits) and cut qty auto-computes as
 * plies × marker ratio per size.
 */
const CuttingReportPivot = ({ report, onLayAdded }) => {
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [lays, setLays] = useState([]);
  const sizes = report.cutPo.sizes;

  useEffect(() => {
    listMarkersForPo(report.cutPo.id).then(setMarkers).catch(() => {});
    listLayAudits().then((all) => setLays(all.filter((l) => l.cutPoId === report.cutPo.id))).catch(() => {});
  }, [report.cutPo.id]);

  const rows = useMemo(() => {
    const orderRow = { key: 'order', label: 'Order Qty', ...report.cutPo.sizeQty, total: report.cutPo.orderQty, frozen: true };
    const layRows = report.lays.map((l) => ({
      key: `lay-${l.id}`, label: `Lay ${l.layNo} · ${dayjs(l.date).format('DD-MMM')}`,
      cutBy: l.cutBy, pieceRate: l.pieceRate, plies: l.plies,
      ...l.sizeQty, total: Object.values(l.sizeQty).reduce((s, v) => s + v, 0),
    }));
    const cutRow = { key: 'cut', label: 'Total Cut', ...report.cutBySize, total: report.totalCut, frozen: true };
    const balRow = { key: 'balance', label: 'Balance', ...report.balance, total: report.cutPo.orderQty - report.totalCut, frozen: true };
    return [orderRow, ...layRows, cutRow, balRow];
  }, [report]);

  const columns = useMemo(() => [
    { title: 'Lay / Date', dataIndex: 'label', width: 170, fixed: 'left', render: (v, r) => (r.frozen ? <strong>{v}</strong> : v) },
    {
      title: 'Cutting By', key: 'cutBy', width: 140,
      render: (_, r) => {
        if (r.frozen) return null;
        return r.cutBy === 'Contractor'
          ? <Tooltip title={`Piece rate ₹${r.pieceRate}/pc`}><Tag color="purple">Contractor</Tag></Tooltip>
          : <Tag>In-house</Tag>;
      },
    },
    { title: 'Plies', dataIndex: 'plies', width: 70, align: 'center' },
    ...sizes.map((size) => ({
      title: size, dataIndex: size, width: 90, align: 'center',
      render: (v, r) => {
        if (r.key === 'balance') {
          const color = v === 0 ? 'var(--success-color)' : v < 0 ? 'var(--error-color)' : undefined;
          return <strong style={{ color }}>{v}{v < 0 ? ' ⚠' : v === 0 ? ' ✓' : ''}</strong>;
        }
        return r.frozen ? <strong>{v}</strong> : v;
      },
    })),
    { title: 'Total', dataIndex: 'total', width: 90, align: 'center', render: (v, r) => (r.frozen ? <strong>{v}</strong> : v) },
  ], [sizes]);

  const draftMarkerId = draft?.markerId;
  const draftPlies = draft?.plies;
  const marker = useMemo(() => markers.find((m) => m.id === draftMarkerId), [markers, draftMarkerId]);
  const markerLays = useMemo(() => lays.filter((l) => l.markerId === draftMarkerId), [lays, draftMarkerId]);

  /** Cut qty per size = plies × marker ratio (auto, per CR note). */
  const autoQty = useMemo(() => {
    if (!marker || !draftPlies) return null;
    return Object.fromEntries(sizes.map((s) => [s, draftPlies * (marker.ratio?.[s] || 0)]));
  }, [marker, draftPlies, sizes]);

  const openModal = useCallback(() => {
    setDraft({ date: dayjs().format('YYYY-MM-DD'), markerId: null, layAuditId: null, layNo: null, plies: null, cutBy: 'In-house', pieceRate: null });
    setModalOpen(true);
  }, []);

  const handleAdd = async () => {
    if (!draft.markerId || !draft.layAuditId) return message.warning('Select the Marker # and Lay # this cut belongs to');
    if (!draft.plies) return message.warning('Enter the plies cut');
    const sizeQty = autoQty || {};
    const total = Object.values(sizeQty).reduce((s, v) => s + (v || 0), 0);
    if (!total) return message.warning('The selected marker has no size ratio — check the marker plan');
    await addReportLay({ cutPoId: report.cutPo.id, date: draft.date, layNo: draft.layNo, plies: draft.plies, cutBy: draft.cutBy, pieceRate: draft.pieceRate, sizeQty });
    message.success(`Lay ${draft.layNo} recorded — ${total} pcs (auto from ${marker.markerNo})`);
    setModalOpen(false);
    onLayAdded();
  };

  return (
    <Card title="Size-wise Cutting (ratio-based per lay)"
      extra={<Button icon={<PlusOutlined />} size="small" onClick={openModal}>Record Lay Cut</Button>}>
      <Table rowKey="key" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 800 }}
        rowClassName={(r) => (r.frozen ? 'ant-table-row-selected' : '')} />
      <Modal
        title="Record Cut for a Lay (auto from marker plan)"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        okText="Add Lay"
        destroyOnHidden
      >
        {draft && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Space size="middle" wrap>
              <FormSelect size="small" value={draft.markerId} style={{ width: 190 }} placeholder="Marker #"
                options={markers.map((m) => ({ value: m.id, label: `${m.markerNo} · ${m.planNo}` }))}
                onChange={(v) => {
                  const m = markers.find((x) => x.id === v);
                  setDraft((d) => ({ ...d, markerId: v, layAuditId: null, layNo: null, plies: m?.markerHeight ?? d.plies }));
                }} />
              <FormSelect size="small" value={draft.layAuditId} style={{ width: 150 }} placeholder="Lay #" disabled={!draft.markerId}
                options={markerLays.map((l) => ({ value: l.id, label: `Lay ${l.layNo} · ${dayjs(l.date).format('DD-MMM')}` }))}
                onChange={(v) => {
                  const l = markerLays.find((x) => x.id === v);
                  setDraft((d) => ({ ...d, layAuditId: v, layNo: l?.layNo, date: l?.date ?? d.date, plies: l?.plies ?? d.plies }));
                }} />
              <span>Plies<InputNumber size="small" min={1} value={draft.plies} style={{ width: 80, marginLeft: 6 }} onChange={(v) => setDraft((d) => ({ ...d, plies: v }))} /></span>
              <DatePicker size="small" format="DD-MMM-YYYY" allowClear={false} value={dayjs(draft.date)} onChange={(d) => setDraft((x) => ({ ...x, date: d.format('YYYY-MM-DD') }))} />
              <FormSelect size="small" value={draft.cutBy} style={{ width: 120 }}
                options={CUTTING_BY_OPTIONS.map((o) => ({ value: o, label: o }))} onChange={(v) => setDraft((d) => ({ ...d, cutBy: v }))} />
              {draft.cutBy === 'Contractor' && (
                <span>Rate ₹/pc<InputNumber size="small" min={0} step={0.25} value={draft.pieceRate} style={{ width: 90, marginLeft: 6 }} onChange={(v) => setDraft((d) => ({ ...d, pieceRate: v }))} /></span>
              )}
            </Space>
            <Space size="middle" wrap>
              {sizes.map((s) => (
                <span key={s} style={{ color: 'var(--text-secondary)' }}>{s}: <strong style={{ color: 'var(--text-primary, inherit)' }}>{autoQty?.[s] ?? '—'}</strong></span>
              ))}
              <Tag color="blue">Total {autoQty ? Object.values(autoQty).reduce((s, v) => s + v, 0) : 0} pcs</Tag>
            </Space>
            <span style={{ color: 'var(--text-secondary)' }}>
              Cut qty auto-calculates: plies × marker ratio {marker ? `(${sizes.map((s) => marker.ratio?.[s] || 0).join(':')})` : ''} — no manual size entry.
            </span>
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default CuttingReportPivot;
