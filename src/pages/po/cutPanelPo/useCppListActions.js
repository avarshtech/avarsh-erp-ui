import { useCallback, useState } from 'react';
import { App } from 'antd';
import { getCpp, deleteCpp } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { printJobWorkPo } from '../../../utils/jobWorkPoPrint';
import { cppValue } from '../../../utils/cutPanelPoCalc';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Row actions of the Cut Panel PO list: Print loads a submitted PO and opens its vendor copy (`printingId` spins
 * that row's Print meanwhile); Delete removes a draft — the row carries its version — then reloads the list.
 */
const useCppListActions = (reload) => {
  const { message } = App.useApp();
  const [printingId, setPrintingId] = useState(null);

  const print = useCallback(async (row) => {
    setPrintingId(row.id);
    try {
      const doc = await getCpp(row.id);
      const org = getCachedOrganisation() || (await fetchAndCacheOrganisation()) || {};
      if (!printJobWorkPo(doc, cppValue(doc), org)) message.warning('Allow pop-ups to print the vendor copy.');
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not print the PO');
    } finally {
      setPrintingId(null);
    }
  }, [message]);

  const remove = useCallback(async (row) => {
    try {
      await deleteCpp(row);
      message.success(`${row.poNo} deleted`);
      reload();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not delete the draft');
    }
  }, [message, reload]);

  return { print, printingId, remove };
};

export default useCppListActions;
