import { useCallback, useState } from 'react';
import { App } from 'antd';
import { lastRates } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { vendorSnapshot } from '../../../utils/jobWorkPoLines';
import { printJobWorkPo } from '../../../utils/jobWorkPoPrint';
import { withLastRates } from '../../../utils/garmentProcessPoCalc';

/**
 * Vendor and print handlers of the Garment Process PO. Choosing a vendor on a
 * draft re-applies its tax basis (IGST tick), its payment terms when they name a master
 * entry, and its last rates on lines without one — the change is audited on save (§13).
 * The approver's sign-off on a warned vendor is the Approval panel's (useGpoSignOff).
 */
const useGpoHandlers = ({ doc, dispatch, masters, value }) => {
  const { message } = App.useApp();

  const pickVendor = useCallback(async (v) => {
    const fromVendor = !masters.paymentTerms.length || masters.paymentTerms.some((t) => t.name === v.paymentTerms);
    const label = doc.lines[0]?.processLabel;
    const rates = label ? (await lastRates({ vendor: v, lines: doc.lines })).byKey : {};
    dispatch({ type: 'PATCH', patch: { vendor: vendorSnapshot(v), paymentTerms: (fromVendor && v.paymentTerms) || doc.paymentTerms || null, lines: withLastRates(doc.lines, rates) } });
  }, [doc, dispatch, masters.paymentTerms]);

  // `printing` spins Print while the organisation (letterhead) is fetched on first use
  const [printing, setPrinting] = useState(false);
  const print = useCallback(async () => {
    setPrinting(true);
    try {
      const org = getCachedOrganisation() || (await fetchAndCacheOrganisation()) || {};
      if (!printJobWorkPo(doc, value, org)) message.warning('Allow pop-ups to print the PO.');
    } finally {
      setPrinting(false);
    }
  }, [doc, value, message]);

  return { pickVendor, print, printing };
};

export default useGpoHandlers;
