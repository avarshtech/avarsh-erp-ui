import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, InputNumber, Space, Table } from 'antd';
import { FormSelect } from '../../../components/form';
import { listIssuableCutPanelPos } from '../../../services/production/cuttingService';
import JobWorkPoSummary from '../shared/JobWorkPoSummary';

const n = (v) => Number(v || 0).toLocaleString('en-IN');

/**
 * An in-house Cut PO's panel issue (D4, D5): the approved Cut Panel POs for its order, then the process the
 * chosen PO is for, its job worker and dates read-only, and its lines in the Cut PO's colours with what each
 * still has to send. Controlled: `value` = { jobWorkPoId, processId, qty: { [poLineId]: n } }, `onChange(next)`.
 */
const PanelIssueFromPo = ({ cutPo, value, onChange }) => {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    let alive = true;
    listIssuableCutPanelPos(cutPo.id).then((list) => { if (alive) setPos(list); }).catch(() => { if (alive) setPos([]); });
    return () => { alive = false; };
  }, [cutPo.id]);

  const po = useMemo(() => pos?.find((p) => p.id === value.jobWorkPoId) || null, [pos, value.jobWorkPoId]);
  const setQty = (id, q) => onChange({ ...value, qty: { ...value.qty, [id]: q } });
  const fillBalance = () => onChange({ ...value, qty: Object.fromEntries(po.lines.map((l) => [l.id, Number(l.balance)])) });

  const columns = [
    { title: 'Colour', dataIndex: 'color', width: 110, ellipsis: true },
    { title: 'Fabric', dataIndex: 'fabricName', width: 120, ellipsis: true },
    { title: 'Panel', dataIndex: 'panel', width: 110, ellipsis: true },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'PO Qty', dataIndex: 'poQty', width: 80, align: 'right', render: n },
    { title: 'Sent', dataIndex: 'issuedQty', width: 70, align: 'right', render: n },
    { title: 'Balance', dataIndex: 'balance', width: 80, align: 'right', render: (v) => <strong>{n(v)}</strong> },
    {
      title: 'Issue Qty', key: 'qty', width: 110, align: 'center',
      render: (_, l) => (
        <InputNumber name={`issue-${l.id}`} size="small" min={0} max={Number(l.balance)} precision={0} style={{ width: 90 }}
          value={value.qty[l.id]} disabled={!(Number(l.balance) > 0)} onChange={(q) => setQty(l.id, q)} />
      ),
    },
  ];

  if (pos && !pos.length) {
    return (
      <Alert type="warning" showIcon title={`No approved Cut Panel PO for ${cutPo.orderNo || 'this order'}`}
        description={`${cutPo.cutPoNo} is cut in-house, so its panels go out against an approved Cut Panel PO — raise one under Purchase Orders › Cut Panel PO.`} />
    );
  }
  return (
    <>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <FormSelect
          value={value.jobWorkPoId} style={{ width: 300 }} placeholder="Approved Cut Panel PO" loading={!pos} aria-label="Cut Panel PO"
          options={(pos || []).map((p) => ({ value: p.id, label: `${p.poNo} · ${p.processLabel} · ${p.vendorName}` }))}
          onChange={(id) => onChange({ jobWorkPoId: id, processId: pos.find((p) => p.id === id)?.processId ?? null, qty: {} })}
        />
        <FormSelect
          value={po ? po.processId : undefined} style={{ width: 200 }} placeholder="Process" disabled aria-label="Process"
          options={po ? [{ value: po.processId, label: po.processLabel }] : []}
        />
        <Button size="small" disabled={!po} onClick={fillBalance}>Fill balance</Button>
      </Space>
      <JobWorkPoSummary po={po} />
      <Table rowKey="id" size="small" columns={columns} dataSource={po?.lines || []} pagination={false} scroll={{ x: 750 }}
        locale={{ emptyText: po ? 'Nothing left to send on this PO' : 'Pick the approved Cut Panel PO these panels go out against' }} />
    </>
  );
};

export default PanelIssueFromPo;
