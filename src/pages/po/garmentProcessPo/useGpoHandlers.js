import { useCallback } from 'react';
import { App } from 'antd';
import dayjs from 'dayjs';
import { lastRates } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { vendorSnapshot } from '../../../utils/jobWorkPoLines';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { printJobWorkPo } from '../../../utils/jobWorkPoPrint';
import { withLastRates } from '../../../utils/garmentProcessPoCalc';

/**
 * Vendor, approval and print handlers of the Garment Process PO. Choosing a vendor on a
 * draft re-applies its tax basis (IGST tick), its payment terms when they name a master
 * entry, and its last rates on lines without one — the change is audited on save (§13).
 * Approving over an unapproved or untagged vendor asks for the approver's sign-off (§13).
 */
const useGpoHandlers = ({ doc, dispatch, masters, ctx, value, flow }) => {
  const { message, modal } = App.useApp();

  const pickVendor = useCallback(async (v) => {
    const fromVendor = !masters.paymentTerms.length || masters.paymentTerms.some((t) => t.name === v.paymentTerms);
    const label = doc.lines[0]?.processLabel;
    const rates = label ? (await lastRates({ type: 'GPO', gstin: v.gstin, processLabel: label })).byKey : {};
    dispatch({ type: 'PATCH', patch: { vendor: vendorSnapshot(v), paymentTerms: (fromVendor && v.paymentTerms) || doc.paymentTerms || null, lines: withLastRates(doc.lines, rates) } });
  }, [doc, dispatch, masters.paymentTerms]);

  const approve = useCallback(() => {
    // Warnings on the live vendor and on the PO's own vendor snapshot both need the sign-off.
    const snapshot = doc.vendor ? vendorEligibility(doc.vendor, { processId: doc.process?.id ?? null, processLabel: doc.lines[0]?.processLabel, category: 'Garment', onDate: dayjs() }) : null;
    const warnings = [...new Set([...(ctx?.eligibility?.issues || []), ...(snapshot?.issues || [])].filter((i) => i.warnOnly).map((i) => i.text))];
    if (!warnings.length) return flow.approve(false);
    return modal.confirm({
      title: `Sign off ${doc.vendor?.name}?`, okText: 'Sign off and approve',
      content: `${warnings.join('; ')}. Approving records your sign-off on the PO.`,
      onOk: () => flow.approve(true, warnings),
    });
  }, [ctx, doc, flow, modal]);

  const print = useCallback(async () => {
    const org = getCachedOrganisation() || (await fetchAndCacheOrganisation()) || {};
    if (!printJobWorkPo(doc, value, org)) message.warning('Allow pop-ups to print the PO.');
  }, [doc, value, message]);

  return { pickVendor, approve, print };
};

export default useGpoHandlers;
