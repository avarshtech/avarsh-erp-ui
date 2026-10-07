import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, InputNumber, Row, Select, Skeleton, Space, Table, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getIssueTargets, getPartyStock, issueToProduction } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../../utils/uiConstants';
import { MATERIAL_KIND, TARGET_TYPE, TARGET_TYPE_LABEL } from '../../../../../utils/jobWorkInward/inwardConstants';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;
/** Which lots can go to a target: fabric to its colour's Cutting PO, panels and trims to sewing, trims to finishing, panels to a process vendor. */
const fits = (lot, t) => {
  if (!t) return false;
  if (t.type === TARGET_TYPE.CUTTING_PO) return lot.kind === MATERIAL_KIND.FABRIC && (!t.colour || t.colour === lot.colour);
  if (t.type === TARGET_TYPE.PROCESS_PO) return lot.kind === MATERIAL_KIND.PANELS;
  if (t.type === TARGET_TYPE.FINISHING_PO) return lot.kind === MATERIAL_KIND.TRIM;
  return lot.kind !== MATERIAL_KIND.FABRIC;
};

/** Material Issue's party-lot mode, previewed: the principal's lots go only to their own order's documents. */
const IssueToProductionDrawer = ({ jobOrderId, presetLotId, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [targets, setTargets] = useState(null);
  const [lots, setLots] = useState([]);
  const [target, setTarget] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getIssueTargets(jobOrderId), getPartyStock({ jobOrderId })]).then(([t, tree]) => {
      const all = tree.flatMap((p) => p.children.flatMap((o) => o.children)).filter((l) => l.ledger.inStore > 0);
      const preset = all.find((l) => l.id === presetLotId);
      setTargets(t);
      setLots(all);
      const first = t.find((x) => preset && fits(preset, x)) || null;
      setTarget(first);
      if (preset && first) setQty({ [preset.id]: preset.ledger.inStore });
    }).catch((e) => toastUnlessHandled(message, e));
  }, [jobOrderId, presetLotId, message]);

  const shown = lots.filter((l) => fits(l, target));
  const lines = shown.filter((l) => (qty[l.id] || 0) > 0).map((l) => ({ lotId: l.id, qty: qty[l.id] }));
  const submit = async () => {
    setBusy(true);
    try {
      const res = await issueToProduction({ jobOrderId, target, date, lines });
      message.success(`${res.issueNo}: issued to ${target.docNo}.`);
      onSaved();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  const columns = [
    { title: 'Lot', dataIndex: 'lotNo', render: (v, l) => <><Text strong style={{ fontSize: 12 }}>{v}</Text> · {l.itemName}{l.size ? ` — ${l.size}` : ''}<br /><Text type="secondary" style={{ fontSize: 11 }}>Their challan {l.theirDcNo}{l.rolls ? ` · ${l.rolls.length} rolls` : ''}</Text></> },
    { title: 'In store', key: 's', width: 120, align: 'right', render: (_, l) => `${fmtQty(l.ledger.inStore)} ${l.uom}` },
    { title: 'Issue', key: 'q', width: 130, render: (_, l) => <InputNumber name={`issue-${l.id}`} size="small" min={0} max={l.ledger.inStore} style={{ width: '100%' }} value={qty[l.id]} onChange={(v) => setQty((x) => ({ ...x, [l.id]: v || 0 }))} /> },
  ];
  return (
    <Drawer open size={820} destroyOnHidden onClose={onClose} title="Issue the principal's material to production"
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={busy} disabled={!target || !lines.length} onClick={submit}>Issue</Button></Space>}>
      {!targets && <Skeleton active />}
      {targets && !targets.length && <Alert type="info" showIcon title="Raise the order's Cutting PO or Work Order first, as for any order; then its material can be issued." />}
      {targets?.length > 0 && (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={24} md={16}>
              <Text type="secondary" style={{ fontSize: 12 }}>To</Text>
              <Select name="issueTarget" style={{ width: '100%' }} value={target?.docNo} onChange={(v) => { setTarget(targets.find((t) => t.docNo === v)); setQty({}); }}
                options={targets.map((t) => ({ value: t.docNo, label: `${t.docNo} — ${TARGET_TYPE_LABEL[t.type]} · ${t.name}${t.colour ? ` · ${t.colour}` : ''}` }))} />
            </Col>
            <Col xs={24} md={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Issue date</Text>
              <DatePicker name="issueDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)} disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
            </Col>
          </Row>
          <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={shown} locale={{ emptyText: target ? 'Nothing in store fits this document.' : 'Pick where it goes.' }} />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>At integration, fabric is picked roll by roll in Material Issue&apos;s roll picker, which then shows only this principal&apos;s rolls.</Text>
        </>
      )}
    </Drawer>
  );
};

export default IssueToProductionDrawer;
