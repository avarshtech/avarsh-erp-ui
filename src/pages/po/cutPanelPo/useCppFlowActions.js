import { useMemo } from 'react';
import * as svc from '../../../services/po/cutPanelPo/cutPanelPoService';

/**
 * Workflow and amendment actions of a Cut Panel PO. Each adopts the PO the mock returns;
 * reasons come from the reason dialog as { reasonCode, remark }. `rev` is the open
 * amendment's working copy (saved before it is submitted).
 */
const useCppFlowActions = ({ doc, rev, dirty, dispatch, clearDirty, runner }) => {
  const { run } = runner;
  const id = doc?.id;
  return useMemo(() => {
    const act = (kind, fn, okText) => run(kind, async () => {
      dispatch({ type: 'SAVED', doc: await fn() });
      clearDirty();
    }, okText);
    return {
      recall: () => act('recall', () => svc.recallCpp(id), 'Recalled to Draft'),
      approve: () => act('approve', () => svc.approveCpp(id), 'Approved'),
      sendBack: ({ remark }) => act('sendBack', () => svc.sendBackCpp(id, remark), 'Sent back for correction'),
      reject: ({ remark }) => act('reject', () => svc.rejectCpp(id, remark), 'PO rejected'),
      send: () => act('send', () => svc.sendCppToVendor(id), 'Sent to the vendor'),
      cancel: (reason) => act('cancel', () => svc.cancelCpp(id, reason), 'PO cancelled — its allocation is released'),
      shortClose: (reason) => act('shortClose', () => svc.shortCloseCpp(id, reason), 'PO closed short — the unreceived balance is released'),
      saveDetails: (patch) => act('details', () => svc.updateCppDetails(id, patch), 'Changes saved'),
      amend: ({ remark }) => act('amend', () => svc.amendCpp(id, remark), 'Amendment opened'),
      saveRev: () => act('saveRev', () => svc.saveCppRevision(id, rev), 'Amendment saved'),
      submitRev: () => act('submitRev', async () => {
        if (dirty) await svc.saveCppRevision(id, rev);
        return svc.submitCppRevision(id);
      }, 'Amendment submitted for approval'),
      approveRev: () => act('approveRev', () => svc.approveCppRevision(id), 'Amendment approved'),
      sendBackRev: ({ remark }) => act('sendBackRev', () => svc.sendBackCppRevision(id, remark), 'Amendment sent back'),
      dropRev: ({ remark }) => act('dropRev', () => svc.dropCppRevision(id, remark), 'Amendment dropped — the live PO is unchanged'),
    };
  }, [id, rev, dirty, run, dispatch, clearDirty]);
};

export default useCppFlowActions;
