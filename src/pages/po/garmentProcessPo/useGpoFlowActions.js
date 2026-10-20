import { useMemo } from 'react';
import * as svc from '../../../services/po/garmentProcessPo/garmentProcessPoService';

/**
 * Workflow actions of a Garment Process PO (PRD §16). Each sends the version on screen and adopts the PO the
 * server returns; reasons come from the reason dialog as { reasonCode, remark }. Approval decisions are the
 * engine's (the Approval panel, with the vendor sign-off).
 */
const useGpoFlowActions = ({ doc, dispatch, clearDirty, runner }) => {
  const { run } = runner;
  return useMemo(() => {
    const act = (kind, fn, okText) => run(kind, async () => {
      dispatch({ type: 'SAVED', doc: await fn() });
      clearDirty();
    }, okText);
    return {
      recall: () => act('recall', () => svc.recallGpo(doc), 'Recalled to Draft — the allocation is released'),
      send: () => act('send', () => svc.sendGpoToVendor(doc), 'Sent to the vendor'),
      cancel: (reason) => act('cancel', () => svc.cancelGpo(doc, reason), 'PO cancelled — its allocation is released'),
      shortClose: (reason) => act('shortClose', () => svc.shortCloseGpo(doc, reason), 'PO closed — the unreturned balance is released'),
      amend: (patch, reason) => act('amend', () => svc.amendGpoDates(doc, patch, reason), 'Delivery / instructions amended'),
    };
  }, [doc, run, dispatch, clearDirty]);
};

export default useGpoFlowActions;
