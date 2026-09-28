import { useMemo } from 'react';
import * as svc from '../../../services/po/garmentProcessPo/garmentProcessPoService';

/**
 * Workflow actions of a Garment Process PO (PRD §16). Each adopts the PO the mock returns;
 * reasons come from the reason dialog as { reasonCode, remark }.
 */
const useGpoFlowActions = ({ doc, dispatch, clearDirty, runner }) => {
  const { run } = runner;
  const id = doc?.id;
  return useMemo(() => {
    const act = (kind, fn, okText) => run(kind, async () => {
      dispatch({ type: 'SAVED', doc: await fn() });
      clearDirty();
    }, okText);
    return {
      recall: () => act('recall', () => svc.recallGpo(id), 'Recalled to Draft — the allocation is released'),
      approve: (signOff = false, acknowledged = []) => act('approve', () => svc.approveGpo(id, { signOff, acknowledged }), 'Approved'),
      reject: ({ remark }) => act('reject', () => svc.rejectGpo(id, remark), 'Rejected to Draft — the allocation is released'),
      send: () => act('send', () => svc.sendGpoToVendor(id), 'Sent to the vendor'),
      cancel: (reason) => act('cancel', () => svc.cancelGpo(id, reason), 'PO cancelled — its allocation is released'),
      shortClose: (reason) => act('shortClose', () => svc.shortCloseGpo(id, reason), 'PO closed — the unreturned balance is released'),
      amend: (patch, reason) => act('amend', () => svc.amendGpoDates(id, patch, reason), 'Dates / remarks amended'),
    };
  }, [id, run, dispatch, clearDirty]);
};

export default useGpoFlowActions;
