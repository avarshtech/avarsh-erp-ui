import { Tag } from 'antd';
import { PRODUCTION_ORDER_KINDS } from '../engine/adapters/productionOrders';
import { formatQty } from '../engine/util';
import { RISK, STAGE_LABEL } from './tokens';

const PO_STEPS = ['raised', 'approval', 'sent', 'receiving', 'received'];
const PO_STEP_LABEL = { raised: 'Raised', approval: 'Awaiting approval', sent: 'With supplier', receiving: 'Arriving', received: 'In store', closed: 'Closed' };
const shortDate = (day) => (day ? new Date(`${day}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—');

const Stitch = ({ pct }) => (
  <div className="vf-stitch" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);

const orderBody = (order, progress) => ({
  kind: 'Customer order', no: order.no, party: `${order.buyer}${order.style ? `, ${order.style}` : ''}`,
  pct: progress?.overallPct ?? 0,
  left: `${formatQty(order.qty)} pcs · due ${shortDate(order.due)}`,
  right: <Tag color={RISK[progress?.risk]?.color} variant="filled" style={{ marginInlineEnd: 0 }}>{progress ? `${STAGE_LABEL[progress.current]} · ${RISK[progress.risk]?.label}` : '—'}</Tag>,
});

const poBody = (po, today) => {
  const late = po.due && po.due < today && (po.stage === 'sent' || po.stage === 'receiving');
  return {
    kind: 'Purchase order', no: po.no, party: `${po.supplier}${po.material ? `, ${po.material}` : ''}`,
    pct: ((PO_STEPS.indexOf(po.stage) + 1) / PO_STEPS.length) * 100,
    left: `${po.qty ? `${formatQty(po.qty)} ${po.uom} · ` : ''}due ${shortDate(po.due)}`,
    right: <Tag color={late ? 'error' : 'default'} variant="filled" style={{ marginInlineEnd: 0 }}>{late ? 'Late' : PO_STEP_LABEL[po.stage]}</Tag>,
  };
};

const productionBody = (po, done) => ({
  kind: PRODUCTION_ORDER_KINDS[po.kind]?.label || 'Production order', no: po.no, party: `${po.orderNo}${po.style ? `, ${po.style}` : ''}`,
  pct: (done / Math.max(1, po.plannedQty || po.orderQty)) * 100,
  left: `${formatQty(po.plannedQty || po.orderQty)} pcs${po.inHouse ? '' : ` · ${po.vendor || 'outside'}`}`,
  right: <Tag variant="filled" style={{ marginInlineEnd: 0 }}>{po.status.replaceAll('_', ' ').toLowerCase()}</Tag>,
});

/** A document as a job ticket: what it is, its number, who it is for, how far it has got. */
export default function JobTicket({ type, item, progress, done, today, selected, onOpen }) {
  const body = type === 'order' ? orderBody(item, progress) : type === 'po' ? poBody(item, today) : productionBody(item, done || 0);
  return (
    <button type="button" className="vf-ticket" aria-pressed={selected} onClick={() => onOpen(item)}>
      <div className="vf-ticket-kind">{body.kind}</div>
      <div className="vf-ticket-no">{body.no}</div>
      <div className="vf-ticket-party">{body.party}</div>
      <Stitch pct={body.pct} />
      <div className="vf-ticket-foot"><span>{body.left}</span>{body.right}</div>
    </button>
  );
}
