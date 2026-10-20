import { useEffect, useState } from 'react';
import { App } from 'antd';
import { listBpSuppliers, listBillablePos } from '../../../services/inventory/billPassingService';
import { listJobWorkBillableVendors, listJobWorkBillablePos } from '../../../services/inventory/jobWorkBill/jobWorkBillService';
import { billSourceOf, isJobWorkSource } from '../../../utils/jobWorkBillConstants';

/**
 * What New Bill can be raised for, for one bill type: its parties (suppliers, or vendors with a final PO
 * waiting) and, once one is picked, its billable POs. Each answer is kept with the request it answers, so a
 * stale one is never shown and nothing is cleared from an effect.
 */
export default function useBillCreateSources({ open, source, partyId }) {
  const { message } = App.useApp();
  const jobWork = isJobWorkSource(source);
  const party = billSourceOf(source).party.toLowerCase();
  const [parties, setParties] = useState({ key: null, rows: [] });
  const [pos, setPos] = useState({ key: null, rows: [] });

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    (jobWork ? listJobWorkBillableVendors(source) : listBpSuppliers())
      .then((rows) => { if (alive) setParties({ key: source, rows: rows || [] }); })
      // The interceptor (or the demo facade) already toasts anything that was refused.
      .catch((e) => { if (alive && !e.response) message.error(e.message || `Failed to load ${party}s`); });
    return () => { alive = false; };
  }, [open, source, jobWork, party, message]);

  const posKey = `${source}:${partyId}`;
  useEffect(() => {
    if (!open || !partyId) return undefined;
    let alive = true;
    (jobWork ? listJobWorkBillablePos({ source, vendorId: partyId }) : listBillablePos({ supplierId: partyId }))
      .then((rows) => { if (alive) setPos({ key: posKey, rows: rows || [] }); })
      .catch((e) => { if (alive && !e.response) message.error(e.message || 'Failed to load billable purchase orders'); });
    return () => { alive = false; };
  }, [open, source, jobWork, partyId, posKey, message]);

  return {
    parties: parties.key === source ? parties.rows : [],
    pos: partyId && pos.key === posKey ? pos.rows : [],
    posLoading: Boolean(partyId) && pos.key !== posKey,
  };
}
