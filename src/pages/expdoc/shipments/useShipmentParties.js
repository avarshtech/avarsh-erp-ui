import { useEffect, useMemo, useCallback } from 'react';
import { Form } from 'antd';
import {
  NOTIFY_BANK, notifyValueOf, notifyPartyOf, isNotifyValueValid, soleNotifyValue, notifyOptionsOf,
  needsConsigneeAddress, consigneeAddressOptions, consigneeLocationOf, consigneeOf, notifyOf, rematchLocationId,
} from './shipmentParties';
import useConsigneeOrders from './useConsigneeOrders';
import { poChoicesOf, poKey, orderPosPayload } from './shipmentPos';

/**
 * The consignee side of the shipment form (rules in shipmentParties): the buyer the
 * consignee names, its orders, the notify party, the consignee address when the bank
 * is notified, what all of it prints as, and the ids a save sends. The server builds
 * the printed blocks itself, from the same buyer master.
 */
const useShipmentParties = (form, buyers, record) => {
  const buyerId = Form.useWatch('buyerId', form);
  const notifyValue = Form.useWatch('notifyValue', form);
  const locationId = Form.useWatch('consigneeLocationId', form);
  const orderIds = Form.useWatch('orderIds', form);
  const buyer = useMemo(
    () => (buyerId == null ? null : (buyers || []).find((b) => b.id === buyerId) || null),
    [buyers, buyerId],
  );

  // The saved choices belong to the saved consignee, never offered for another one.
  // (`buyerId` is undefined for the first render after the form mounts.)
  const isSavedConsignee = Boolean(record) && (buyerId == null || buyerId === record.buyerId);
  const savedOrders = isSavedConsignee ? record.orders : null;
  const orders = useConsigneeOrders(buyerId ?? null, savedOrders);
  const notifyOptions = useMemo(() => {
    if (buyer) return notifyOptionsOf(buyer);
    // Until the buyer master answers, the saved notify party reads by name, not as its code.
    const saved = isSavedConsignee ? notifyValueOf(record.notifyParty) : undefined;
    return saved && record.notify?.name ? [{ value: saved, label: record.notify.name }] : [];
  }, [buyer, isSavedConsignee, record]);
  const addressOptions = useMemo(() => consigneeAddressOptions(buyer), [buyer]);

  // Each picked order with the buyer POs it offers: the order's own, plus any the shipment
  // saved that the order has since dropped (they stay ticked until unticked)
  const choicesOf = useCallback((orderId) => {
    const offered = orders.options.find((o) => o.value === orderId)?.order.pos || [];
    const saved = (savedOrders || []).find((o) => o.orderId === orderId)?.pos || [];
    return poChoicesOf(offered, saved);
  }, [orders.options, savedOrders]);
  // Whether an order's POs are known: the picker answered for it, or the shipment saved some
  const knownOf = useCallback((orderId) => Boolean(orders.options.find((o) => o.value === orderId)?.order.fromPicker)
    || Boolean((savedOrders || []).find((o) => o.orderId === orderId)?.pos?.length), [orders.options, savedOrders]);
  const poOrders = useMemo(() => (orderIds || []).map((orderId) => {
    const option = orders.options.find((o) => o.value === orderId);
    return {
      orderId,
      orderNo: option?.order.orderNo ?? String(orderId),
      styleNo: option?.order.styleNo ?? null,
      choices: choicesOf(orderId),
      known: knownOf(orderId),
    };
  }), [orderIds, orders.options, choicesOf, knownOf]);

  // An order whose POs were never ticked (just picked, or saved before POs, when it travelled
  // whole) ticks every PO it offers once they are known; an order unticked by hand stays so
  useEffect(() => {
    poOrders.forEach((o) => {
      if (!o.choices.length || form.getFieldValue(['orderPos', String(o.orderId)]) !== undefined) return;
      form.setFieldValue(['orderPos', String(o.orderId)], o.choices.map(poKey));
    });
  }, [poOrders, form]);

  // Once the buyer master answers: a saved location whose id Buyer Master has renewed is
  // matched again by its label; a choice the master no longer offers at all (a retired
  // location, a removed bank) is cleared, to be picked again.
  useEffect(() => {
    if (!buyer) return;
    if (notifyValue && !isNotifyValueValid(buyer, notifyValue)) {
      const savedLocation = isSavedConsignee && record.notifyParty?.kind === 'LOCATION' ? record.notifyParty : null;
      form.setFieldValue('notifyValue', savedLocation ? notifyValueOf(savedLocation, buyer) : undefined);
    }
    if (locationId != null && !addressOptions.some((o) => o.value === locationId)) {
      const again = isSavedConsignee ? rematchLocationId(buyer, locationId, record.consigneeLocationLabel) : null;
      form.setFieldValue('consigneeLocationId', again ?? undefined);
    }
  }, [buyer, notifyValue, locationId, addressOptions, form, isSavedConsignee, record]);

  /** For onValuesChange: a new consignee clears what belonged to the previous one. */
  const onPartiesChange = useCallback((changed) => {
    if ('buyerId' in changed) {
      const next = (buyers || []).find((b) => b.id === changed.buyerId) || null;
      form.setFieldsValue({
        orderIds: [], orderPos: {}, notifyValue: soleNotifyValue(next), consigneeLocationId: undefined,
      });
    }
    if ('notifyValue' in changed && changed.notifyValue !== NOTIFY_BANK) form.setFieldValue('consigneeLocationId', undefined);
    // An order taken off forgets its ticks: added again, it starts from the POs it offers then
    if ('orderIds' in changed) {
      const picked = new Set((changed.orderIds || []).map(String));
      const ticks = form.getFieldValue('orderPos') || {};
      if (Object.keys(ticks).some((id) => !picked.has(id))) {
        form.setFieldValue('orderPos', Object.fromEntries(Object.entries(ticks).filter(([id]) => picked.has(id))));
      }
    }
  }, [form, buyers]);

  /** The parties' share of the save payload: ids only. */
  const partiesPayload = useCallback((values) => ({
    buyerId: values.buyerId,
    notifyParty: notifyPartyOf(values.notifyValue),
    // The server needs it only when the bank is notified and the buyer has several locations.
    consigneeLocationId: values.notifyValue === NOTIFY_BANK ? values.consigneeLocationId ?? null : null,
    orderIds: values.orderIds || [],
    orderPos: orderPosPayload(values.orderIds || [], values.orderPos, choicesOf, knownOf),
  }), [choicesOf, knownOf]);

  return {
    buyerId,
    orders,
    poOrders,
    notifyOptions,
    addressOptions,
    askAddress: needsConsigneeAddress(buyer, notifyValue),
    consigneePreview: buyer ? consigneeOf(buyer, consigneeLocationOf(buyer, notifyValue, locationId)) : record?.consignee,
    notifyPreview: buyer ? notifyOf(buyer, notifyValue) : record?.notify,
    onPartiesChange,
    partiesPayload,
  };
};

export default useShipmentParties;
