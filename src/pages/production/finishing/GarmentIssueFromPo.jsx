import { useEffect, useMemo, useState } from 'react';
import { Alert, InputNumber, Space, Table } from 'antd';
import { FormSelect } from '../../../components/form';
import { getProcessJobWorkPos } from '../../../services/production/finishingService';
import JobWorkPoSummary from '../shared/JobWorkPoSummary';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const key = (color, size) => `${String(color || '').trim().toUpperCase()}|${String(size || '').trim().toUpperCase()}`;

/**
 * An in-house Work Order's garment issue (D4, D7): the approved Garment Process POs for its order, the process the
 * chosen PO is for, its vendor and dates read-only, and its lines. A line can send what both the Work Order (planned
 * less already sent to that process) and the PO (its balance) still allow. Controlled: `value` =
 * { jobWorkPoId, qty: { [poLineId]: n } }, `onChange(next)`.
 */
const GarmentIssueFromPo = ({ wo, value, onChange }) => {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    let alive = true;
    getProcessJobWorkPos(wo.id).then((list) => { if (alive) setPos(list); }).catch(() => { if (alive) setPos([]); });
    return () => { alive = false; };
  }, [wo.id]);

  const po = useMemo(() => pos?.find((p) => p.id === value.jobWorkPoId) || null, [pos, value.jobWorkPoId]);
  const rows = useMemo(() => {
    if (!po) return [];
    const plan = new Map((wo.rows || []).map((r) => [key(r.color, r.size), r]));
    return po.lines.map((l) => {
      const r = plan.get(key(l.color, l.size));
      const planned = r?.plannedQty ?? 0;
      const sent = r?.issuedByProcess?.[po.processId] ?? 0;
      const woLeft = Math.max(0, planned - sent);
      return { ...l, planned, sent, woLeft, max: Math.max(0, Math.min(woLeft, Number(l.balance))) };
    });
  }, [po, wo]);

  const columns = [
    { title: 'Colour', dataIndex: 'color', width: 140, ellipsis: true },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'WO Planned', dataIndex: 'planned', width: 95, align: 'right', render: n },
    { title: 'Already Sent', dataIndex: 'sent', width: 100, align: 'right', render: n },
    { title: 'PO Balance', dataIndex: 'balance', width: 95, align: 'right', render: n },
    {
      title: 'Issue Qty', key: 'qty', width: 110, align: 'center',
      render: (_, r) => (
        <InputNumber name={`issue-${r.id}`} size="small" min={0} max={r.max} precision={0} style={{ width: 90 }}
          value={value.qty[r.id]} disabled={r.max === 0} onChange={(q) => onChange({ ...value, qty: { ...value.qty, [r.id]: q } })} />
      ),
    },
  ];

  if (pos && !pos.length) {
    return (
      <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={`No approved Garment Process PO for ${wo.orderNo || 'this order'}`}
        description={`${wo.workOrderNo} is finished in-house, so its garments go out against an approved Garment Process PO — raise one under Purchase Orders › Garment Process PO.`} />
    );
  }
  return (
    <>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect
          value={value.jobWorkPoId} style={{ width: 320 }} placeholder="Approved Garment Process PO" loading={!pos} aria-label="Garment Process PO"
          options={(pos || []).map((p) => ({ value: p.id, label: `${p.poNo} · ${p.processLabel} · ${p.vendorName}` }))}
          onChange={(id) => onChange({ jobWorkPoId: id, qty: {} })}
        />
        <FormSelect value={po ? po.processId : undefined} style={{ width: 200 }} placeholder="Process" disabled aria-label="Process"
          options={po ? [{ value: po.processId, label: po.processLabel }] : []} />
      </Space>
      <JobWorkPoSummary po={po} dueLabel="Expected return" />
      <Table rowKey="id" size="small" columns={columns} dataSource={rows} pagination={false}
        locale={{ emptyText: po ? 'Nothing left to send on this PO' : 'Pick the approved Garment Process PO these garments go out against' }} />
    </>
  );
};

export default GarmentIssueFromPo;
