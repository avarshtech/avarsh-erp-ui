import { useCallback, useMemo, useState } from 'react';
import { App, Card, Table, Button, Modal, InputNumber, Space, Tag, DatePicker, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { CUTTING_BY_OPTIONS } from '../../../utils/cuttingConstants';
import { addReportLay } from '../../../services/production/cuttingService';

/**
 * FR-05 pivot — rows are lays, columns are sizes. Frozen Order Qty row on top,
 * running Balance row at the bottom. SME gap-fill: "Cutting By" + piece rate
 * per lay for contractor (outsourced) cutting labour costing.
 */
const CuttingReportPivot = ({ report, onLayAdded }) => {
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const sizes = report.cutPo.sizes;

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

  const openModal = useCallback(() => {
    setDraft({
      date: dayjs().format('YYYY-MM-DD'), layNo: report.lays.length + 1, plies: null,
      cutBy: 'In-house', pieceRate: null, sizeQty: Object.fromEntries(sizes.map((s) => [s, 0])),
    });
    setModalOpen(true);
  }, [report.lays.length, sizes]);

  const handleAdd = async () => {
    const total = Object.values(draft.sizeQty).reduce((s, v) => s + (v || 0), 0);
    if (!total) return message.warning('Enter cut quantity for at least one size');
    const over = sizes.filter((s) => (report.balance[s] - (draft.sizeQty[s] || 0)) < 0);
    if (over.length) message.warning(`Over-cutting on size(s) ${over.join(', ')} — allowed but flagged`);
    await addReportLay({ cutPoId: report.cutPo.id, ...draft });
    message.success(`Lay ${draft.layNo} recorded (${total} pcs)`);
    setModalOpen(false);
    onLayAdded();
  };

  return (
    <Card title="Size-wise Cutting (ratio-based per lay)"
      extra={<Button icon={<PlusOutlined />} size="small" onClick={openModal}>Record Lay Cut</Button>}>
      <Table rowKey="key" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 800 }}
        rowClassName={(r) => (r.frozen ? 'ant-table-row-selected' : '')} />
      <Modal
        title="Record Cut Quantities for a Lay"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        okText="Add Lay"
        destroyOnHidden
      >
        {draft && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space size="middle" wrap>
              <span>Lay #<InputNumber size="small" min={1} value={draft.layNo} style={{ width: 70, marginLeft: 6 }} onChange={(v) => setDraft((d) => ({ ...d, layNo: v }))} /></span>
              <DatePicker size="small" format="DD-MMM-YYYY" allowClear={false} value={dayjs(draft.date)} onChange={(d) => setDraft((x) => ({ ...x, date: d.format('YYYY-MM-DD') }))} />
              <span>Plies<InputNumber size="small" min={1} value={draft.plies} style={{ width: 80, marginLeft: 6 }} onChange={(v) => setDraft((d) => ({ ...d, plies: v }))} /></span>
              <FormSelect size="small" value={draft.cutBy} style={{ width: 120 }}
                options={CUTTING_BY_OPTIONS.map((o) => ({ value: o, label: o }))} onChange={(v) => setDraft((d) => ({ ...d, cutBy: v }))} />
              {draft.cutBy === 'Contractor' && (
                <span>Rate ₹/pc<InputNumber size="small" min={0} step={0.25} value={draft.pieceRate} style={{ width: 90, marginLeft: 6 }} onChange={(v) => setDraft((d) => ({ ...d, pieceRate: v }))} /></span>
              )}
            </Space>
            <Space size="middle" wrap>
              {sizes.map((s) => (
                <span key={s}>{s}
                  <InputNumber size="small" min={0} value={draft.sizeQty[s]} style={{ width: 84, marginLeft: 6 }}
                    onChange={(v) => setDraft((d) => ({ ...d, sizeQty: { ...d.sizeQty, [s]: v || 0 } }))} />
                </span>
              ))}
            </Space>
            <span style={{ color: 'var(--text-secondary)' }}>
              Tip: cut qty per size = plies × marker ratio (e.g. 30 plies × ratio 1:2:2:1 → 30/60/60/30).
            </span>
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default CuttingReportPivot;
