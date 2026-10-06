import { useMemo } from 'react';
import * as svc from '../../../services/po/cutPanelPo/cutPanelPoService';

/**
 * Workflow and amendment actions of a Cut Panel PO. Each sends the version on screen and adopts the PO the
 * server returns; reasons come from the reason dialog as { reasonCode, remark }. `rev` is the open
 * amendment's working copy (saved before it is submitted). Approval decisions are the engine's.
 */
const useCppFlowActions = ({ doc, rev, dirty, dispatch, clearDirty, runner }) => {
  const { run } = runner;
  return useMemo(() => {
    const act = (kind, fn, okText) => run(kind, async () => {
      dispatch({ type: 'SAVED', doc: await fn() });
      clearDirty();
    }, okText);
    return {
      recall: () => act('recall', () => svc.recallCpp(doc), 'Recalled to Draft'),
      send: () => act('send', () => svc.sendCppToVendor(doc), 'Sent to the vendor'),
      cancel: (reason) => act('cancel', () => svc.cancelCpp(doc, reason), 'PO cancelled — its allocation is released'),
      shortClose: (reason) => act('shortClose', () => svc.shortCloseCpp(doc, reason), 'PO closed short — the unreceived balance is released'),
      saveDetails: (patch) => act('details', () => svc.updateCppDetails(doc, patch), 'Changes saved'),
      amend: ({ remark }) => act('amend', () => svc.amendCpp(doc, remark), 'Amendment opened'),
      saveRev: () => act('saveRev', () => svc.saveCppRevision(doc, rev), 'Amendment saved'),
      submitRev: () => act('submitRev', async () => {
        const saved = dirty ? await svc.saveCppRevision(doc, rev) : doc;
        return svc.submitCppRevision(saved);
      }, 'Amendment submitted for approval'),
      dropRev: ({ remark }) => act('dropRev', () => svc.dropCppRevision(doc, remark), 'Amendment discarded — the live PO is unchanged'),
    };
  }, [doc, rev, dirty, run, dispatch, clearDirty]);
};

export default useCppFlowActions;
