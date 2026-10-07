import { useCallback, useState } from 'react';
import { App } from 'antd';
import { getGpo, cancelGpo, deleteGpo } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { printJobWorkPo } from '../../../utils/jobWorkPoPrint';
import { gpoValue } from '../../../utils/garmentProcessPoCalc';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Row actions of the Garment Process PO list (PRD §22): Print loads the PO and opens its
 * print (`printingId` spins that row's Print meanwhile); Cancel asks for the reason, then reloads the list; Delete
 * removes a draft (the row carries its version), then reloads.
 * `reload` refreshes the rows.
 */
const useGpoListActions = (reload) => {
  const { message } = App.useApp();
  const [cancelling, setCancelling] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  const print = useCallback(async (row) => {
    setPrintingId(row.id);
    try {
      const doc = await getGpo(row.id);
      const org = getCachedOrganisation() || (await fetchAndCacheOrganisation()) || {};
      if (!printJobWorkPo(doc, gpoValue(doc), org)) message.warning('Allow pop-ups to print the PO.');
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not print the PO');
    } finally {
      setPrintingId(null);
    }
  }, [message]);

  const remove = useCallback(async (row) => {
    try {
      await deleteGpo(row);
      message.success(`${row.poNo} deleted`);
      reload();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not delete the draft');
    }
  }, [message, reload]);

  const cancel = useCallback(async (reason) => {
    try {
      await cancelGpo(cancelling, reason);
      message.success(`${cancelling.poNo} cancelled`);
      reload();
      return true;
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not cancel the PO');
      return false;
    }
  }, [cancelling, message, reload]);

  return { print, printingId, remove, cancelling, askCancel: setCancelling, cancel, closeCancel: () => setCancelling(null) };
};

export default useGpoListActions;
