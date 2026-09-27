/**
 * The reason dialogs of the Cut Panel PO action bar. Cancel and short close take a reason
 * code and a remark (VR-18); the rest a remark. Every reason is kept permanently (BR-20).
 */
import { CLOSE_REASONS } from '../../../utils/jobWorkConstants';

export const CPP_DIALOGS = {
  cancel: {
    title: 'Cancel PO', okText: 'Cancel PO', danger: true, codes: CLOSE_REASONS,
    intro: 'The PO becomes Cancelled for good and whatever it holds is released back to the requirement.',
  },
  shortClose: {
    title: 'Close short', okText: 'Close', danger: true, codes: CLOSE_REASONS,
    intro: 'The PO closes at the quantity received; the unreceived balance goes back to the requirement for a fresh PO.',
  },
  sendBack: { title: 'Send back for correction', okText: 'Send back', intro: 'The PO returns to Draft with your note. Nothing was allocated, so nothing is lost.' },
  reject: { title: 'Reject PO', okText: 'Reject', danger: true, intro: 'Rejection is final: a fresh PO has to be raised.' },
  amend: { title: 'Amend PO', okText: 'Open amendment', intro: 'Opens the next revision as a draft. The live PO and its allocation stay in force until the amendment is approved.' },
  dropRev: { title: 'Drop amendment', okText: 'Drop amendment', danger: true, intro: 'The amendment is discarded; the live PO stays exactly as it is.' },
  sendBackRev: { title: 'Send back amendment', okText: 'Send back', intro: 'The amendment returns to its author as a draft.' },
};
