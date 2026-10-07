import { memo, useMemo } from 'react';
import { formatDate } from '../../../utils/formatters';
import { calcRequiredQty } from '../../../utils/cutPanelCalc';
import FactSheet from '../../../components/FactSheet';

const qty = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
const date = (v) => formatDate(v, 'DD-MM-YYYY');

/**
 * Read-only order facts of the CPR header (PRD §8.1) — fetched, never edited here. Qty incl. Allowance is the
 * accent: the grid's calculated quantities start from it. Created by / on appears once the requirement is saved.
 */
const CprOrderFacts = memo(function CprOrderFacts({ order, doc }) {
  const facts = useMemo(() => {
    if (!order) return null;
    const allowance = Number(doc?.orderAllowancePct ?? order.allowancePercent) || 0;
    return {
      fields: [
        { label: 'Buyer', value: order.buyer },
        { label: 'Style No.', value: order.styleNo },
        { label: 'Garment', value: order.garmentDescription },
        { label: 'Season', value: order.season },
      ],
      tiles: [
        { label: 'Order Qty', value: qty(order.totalQty) },
        { label: 'Allowance', value: `${allowance.toFixed(2)}%` },
        { label: 'Qty incl. Allowance', value: qty(calcRequiredQty(order.totalQty, 1, allowance)), accent: true },
        { label: 'Order Date', value: date(order.orderDate) },
        { label: 'Delivery Date', value: date(order.deliveryDate) },
      ],
      chips: [
        { label: `Colours · ${order.colors.length}`, items: order.colors.map((c) => ({ key: c.name, text: c.name, swatch: c.hex })) },
        { label: `Sizes · ${order.sizes.length}`, items: order.sizes.map((s) => ({ key: s, text: s })) },
      ],
      footer: doc?.createdBy ? `Created by ${doc.createdBy} on ${date(doc.createdOn)}` : null,
    };
  }, [order, doc]);

  if (!facts) return null;
  return <FactSheet {...facts} />;
});

export default CprOrderFacts;
