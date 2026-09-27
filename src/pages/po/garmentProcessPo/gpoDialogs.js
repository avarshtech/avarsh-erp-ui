/**
 * The reason dialogs of the Garment Process PO action bar (PRD §16): cancel and close take
 * a reason code and a remark; reject a remark. Reasons are kept on the PO and in its history.
 */
import { CLOSE_REASONS } from '../../../utils/jobWorkConstants';

export const GPO_DIALOGS = {
  cancel: {
    title: 'Cancel PO', okText: 'Cancel PO', danger: true, codes: CLOSE_REASONS,
    intro: 'The PO becomes Cancelled for good; any quantity it holds goes back to the requirement.',
  },
  shortClose: {
    title: 'Close PO', okText: 'Close', danger: true, codes: CLOSE_REASONS,
    intro: 'The PO closes at the quantity returned; the rest goes back to the requirement for a fresh PO.',
  },
  reject: { title: 'Reject to Draft', okText: 'Reject', danger: true, intro: 'The PO returns to Draft with your reason, and its quantity goes back to the requirement.' },
};
