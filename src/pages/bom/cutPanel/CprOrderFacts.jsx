import { memo, useMemo } from 'react';
import { Descriptions } from 'antd';
import { formatDate } from '../../../utils/formatters';
import { calcRequiredQty } from '../../../utils/cutPanelCalc';

const qty = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

/** Read-only order facts of the CPR header (PRD §8.1) — fetched, never edited here. */
const CprOrderFacts = memo(function CprOrderFacts({ order, doc }) {
  const items = useMemo(() => {
    if (!order) return [];
    const allowance = Number(doc?.orderAllowancePct ?? order.allowancePercent) || 0;
    return [
      { key: 'buyer', label: 'Buyer', children: order.buyer },
      { key: 'style', label: 'Style No.', children: order.styleNo },
      { key: 'garment', label: 'Garment Description', children: order.garmentDescription },
      { key: 'season', label: 'Season', children: order.season },
      { key: 'orderDate', label: 'Order Date', children: formatDate(order.orderDate, 'DD-MM-YYYY') },
      { key: 'delivery', label: 'Delivery Date', children: formatDate(order.deliveryDate, 'DD-MM-YYYY') },
      { key: 'qty', label: 'Order Quantity', children: qty(order.totalQty) },
      { key: 'allow', label: 'Order Allowance %', children: `${allowance.toFixed(2)}%` },
      { key: 'qtyAllow', label: 'Qty incl. Allowance', children: qty(calcRequiredQty(order.totalQty, 1, allowance)) },
      { key: 'colours', label: 'Colours in Order', children: order.colors.length },
      { key: 'sizes', label: 'Size Set', children: order.sizes.join(' · ') },
      {
        key: 'created',
        label: 'Created By / On',
        children: doc?.createdBy ? `${doc.createdBy} · ${formatDate(doc.createdOn, 'DD-MM-YYYY')}` : 'On first save',
      },
    ];
  }, [order, doc]);

  if (!order) return null;
  return <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3, xl: 4 }} items={items} />;
});

export default CprOrderFacts;
