import { useEffect, useMemo, useCallback } from 'react';
import { Form } from 'antd';
import { findBuyerByName } from '../../sample-request/invoice/consigneeAddress';
import {
  NOTIFY_BANK, notifyValueOf, notifyPartyOf, isNotifyValueValid, soleNotifyValue, notifyOptionsOf,
  needsConsigneeAddress, consigneeAddressOptions, consigneeLocationOf, consigneeOf, notifyOf,
} from './shipmentParties';
import useConsigneeOrders from './useConsigneeOrders';

/**
 * The consignee side of the shipment form (rules in shipmentParties): the buyer the
 * consignee names, its orders, the notify party, the consignee address when the bank
 * is notified, what all of it prints as, and the snapshots a save stores.
 */
const useShipmentParties = (form, buyers, record) => {
  const buyerName = Form.useWatch('buyerName', form);
  const notifyValue = Form.useWatch('notifyValue', form);
  const locationId = Form.useWatch('consigneeLocationId', form);
  const buyer = useMemo(() => findBuyerByName(buyers, buyerName), [buyers, buyerName]);

  // The saved choices belong to the saved consignee — never offered for another one.
  // (`buyerName` is undefined for the first render after the form mounts.)
  const isSavedConsignee = Boolean(record) && (!buyerName || buyerName === record.buyerName);
  const savedOrders = isSavedConsignee ? record.orders : null;
  const orders = useConsigneeOrders(buyer || (buyerName ? { name: buyerName } : null), savedOrders);
  const notifyOptions = useMemo(() => {
    if (buyer) return notifyOptionsOf(buyer);
    // Until the buyer master answers, the saved notify party reads by name, not as its code.
    const saved = isSavedConsignee ? notifyValueOf(record.notifyParty) : undefined;
    return saved && record.notify?.name ? [{ value: saved, label: record.notify.name }] : [];
  }, [buyer, isSavedConsignee, record]);
  const addressOptions = useMemo(() => consigneeAddressOptions(buyer), [buyer]);

  // A saved choice that Buyer Master no longer offers (a retired location, a removed bank) is picked again.
  useEffect(() => {
    if (!buyer) return;
    if (notifyValue && !isNotifyValueValid(buyer, notifyValue)) form.setFieldValue('notifyValue', undefined);
    if (locationId != null && !addressOptions.some((o) => o.value === locationId)) {
      form.setFieldValue('consigneeLocationId', undefined);
    }
  }, [buyer, notifyValue, locationId, addressOptions, form]);

  /** For onValuesChange: a new consignee clears what belonged to the previous one. */
  const onPartiesChange = useCallback((changed) => {
    if ('buyerName' in changed) {
      form.setFieldsValue({
        orderNos: [],
        notifyValue: soleNotifyValue(findBuyerByName(buyers, changed.buyerName)),
        consigneeLocationId: undefined,
      });
    }
    if ('notifyValue' in changed && changed.notifyValue !== NOTIFY_BANK) form.setFieldValue('consigneeLocationId', undefined);
  }, [form, buyers]);

  /** The parties' share of the save payload. A consignee the master does not know keeps its saved blocks. */
  const partiesPayload = useCallback((values) => ({
    buyerId: buyer?.id ?? record?.buyerId ?? null,
    notifyParty: notifyPartyOf(values.notifyValue),
    consigneeLocationId: needsConsigneeAddress(buyer, values.notifyValue) ? values.consigneeLocationId : null,
    consignee: buyer
      ? consigneeOf(buyer, consigneeLocationOf(buyer, values.notifyValue, values.consigneeLocationId))
      : record?.consignee ?? null,
    notify: buyer ? notifyOf(buyer, values.notifyValue) : record?.notify ?? null,
    orders: (values.orderNos || []).map((no) => orders.options.find((o) => o.value === no)?.order
      || { orderId: null, orderNo: no, styleNo: null }),
  }), [buyer, record, orders.options]);

  return {
    buyerName,
    orders,
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
