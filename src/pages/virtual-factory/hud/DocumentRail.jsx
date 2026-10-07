import { useMemo, useState } from 'react';
import { Segmented } from 'antd';
import { isOpenOrder } from '../engine/adapters/orders';
import JobTicket from './JobTicket';

const RISK_ORDER = { late: 0, 'at-risk': 1, 'on-track': 2, unknown: 3, done: 4 };

/** The documents behind the floor, as job tickets: customer orders, supplier POs, production orders. */
export default function DocumentRail({ snapshot, followed, selection, onFollow, onSelect }) {
  const [tab, setTab] = useState('orders');
  const lists = useMemo(() => ({
    orders: snapshot.orders.filter(isOpenOrder).sort((a, b) => {
      const ra = RISK_ORDER[snapshot.progress.get(a.no)?.risk] ?? 3;
      const rb = RISK_ORDER[snapshot.progress.get(b.no)?.risk] ?? 3;
      return ra - rb || String(a.due || '9999').localeCompare(String(b.due || '9999'));
    }),
    pos: snapshot.purchaseOrders.filter((po) => po.stage !== 'closed').sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999'))),
    production: snapshot.productionOrders,
  }), [snapshot]);

  const options = [
    { value: 'orders', label: `Customer orders ${lists.orders.length}` },
    { value: 'pos', label: `Purchase orders ${lists.pos.length}` },
    { value: 'production', label: `Production orders ${lists.production.length}` },
  ];
  const empty = { orders: 'No open customer orders.', pos: 'No open purchase orders.', production: 'No production orders yet.' }[tab];
  /** Work done against a production order: cut for a cutting PO, sewn for a work order, packed for a finishing PO. */
  const doneFor = (po) => {
    if (po.kind === 'CUTTING_PO') return snapshot.cutting.progress.find((p) => p.cutPoNo === po.no)?.cut || 0;
    const stage = po.kind === 'WORK_ORDER' ? 'sewing' : 'packing';
    return snapshot.progress.get(po.orderNo)?.stages.find((s) => s.key === stage)?.qty || 0;
  };
  const list = lists[tab];

  return (
    <section className="vf-panel vf-rail" aria-label="Orders and documents" style={{ padding: '10px 12px' }}>
      <Segmented size="small" value={tab} onChange={setTab} options={options} style={{ marginBottom: 8 }} />
      {list.length === 0 ? (
        <p style={{ margin: '6px 2px 4px', color: 'var(--text-secondary)', fontSize: 12.5 }}>{empty}</p>
      ) : (
        <div className="vf-scroll-x">
          {list.map((item) => (
            <JobTicket
              key={item.key || item.no}
              type={tab === 'orders' ? 'order' : tab === 'pos' ? 'po' : 'production'}
              item={item}
              progress={tab === 'orders' ? snapshot.progress.get(item.no) : null}
              done={tab === 'production' ? doneFor(item) : 0}
              today={snapshot.today}
              selected={tab === 'orders' ? followed === item.no : selection?.id === item.no}
              onOpen={tab === 'orders' ? (o) => onFollow(o.no) : (doc) => onSelect({ type: tab === 'pos' ? 'po' : 'production', id: doc.no })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
