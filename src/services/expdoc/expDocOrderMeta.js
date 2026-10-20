/**
 * What a packing list keeps of each order on its shipment, read from the real orders
 * API when the list is created or refreshed: the garment, the sizes in preset order,
 * the ordered quantities per buyer PO, and the order's POs. Kept on the list because
 * the mock decorates synchronously. An order that cannot be read (no Orders access, or
 * gone) comes back `readable: false` and the list falls back to its packed cartons.
 */
import { getOrderById } from '../orders/orderService';
import { getAllSizePresets } from '../master/sizePresetService';
import { resolveOrderSizes, orderBreakdownOf, orderPosOf } from '../../utils/orderSizes';

const QUIET = { silent: true, timeout: 10000 };

export const orderMetaFor = async (orderIds = []) => {
  const ids = [...new Set(orderIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return {};
  const presets = await getAllSizePresets(QUIET).then((res) => res?.data ?? res ?? []).catch(() => []);
  const metas = await Promise.all(ids.map((orderId) => getOrderById(orderId, QUIET)
    .then((order) => ({
      orderId,
      readable: true,
      orderNo: order.orderNo ?? null,
      styleNo: order.styleNo ?? null,
      garmentName: order.garmentName ?? null,
      compositionText: order.fabricDescription ?? null,
      sizes: resolveOrderSizes(order, presets),
      orderBreakdown: orderBreakdownOf(order),
      pos: orderPosOf(order),
    }))
    .catch(() => ({ orderId, readable: false }))));
  return Object.fromEntries(metas.map((m) => [m.orderId, m]));
};
