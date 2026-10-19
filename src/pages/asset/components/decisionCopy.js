/**
 * What each decision says, per document.
 *
 * <p>Separate from the dialog that draws them because the two documents want
 * different words for the same mechanism, and because a file that exports both
 * a component and its constants breaks fast refresh. Approving a transfer
 * generates a challan; approving a disposal retires a machine and cannot be
 * undone. The second was being described as the first.</p>
 */

/** @typedef {{title: string, body: string, ok: string, done: string,
 *   reasonLabel: string, reasonRequired?: boolean, danger?: boolean,
 *   vehicle?: boolean}} Decision */

/** @type {Record<string, Decision>} */
export const TRANSFER_DECISIONS = {
  approve: {
    title: 'Approve this transfer?',
    body: 'A challan is generated for a move between units. The assets can then be dispatched.',
    ok: 'Approve',
    done: 'approved',
    reasonLabel: 'Note (optional)',
    vehicle: true,
  },
  reject: {
    title: 'Reject this transfer?',
    body: 'Nothing moves. The request is kept with your reason on it.',
    ok: 'Reject',
    done: 'rejected',
    reasonLabel: 'Reason',
    reasonRequired: true,
    danger: true,
  },
  cancel: {
    title: 'Cancel this transfer?',
    body: 'Nothing moves and the assets are released for other transfers. The record is kept.',
    ok: 'Cancel transfer',
    done: 'cancelled',
    reasonLabel: 'Reason (optional)',
    danger: true,
  },
  dispatch: {
    title: 'Mark as dispatched?',
    body: 'The assets go In Transit. They stay recorded at the sending unit until the receiving unit confirms them.',
    ok: 'Mark dispatched',
    done: 'dispatched',
    reasonLabel: 'Note (optional)',
    vehicle: true,
  },
  complete: {
    title: 'Complete this move?',
    body: 'The assets move to the new location now and the movement history is written. This move stays inside one unit, so there is no journey to confirm.',
    ok: 'Complete move',
    done: 'completed',
    reasonLabel: 'Note (optional)',
  },
};

/** @type {Record<string, Decision>} */
export const DISPOSAL_DECISIONS = {
  approve: {
    title: 'Approve this disposal?',
    // Everything approval actually does, because none of it can be taken back.
    body: 'The asset is marked Disposed, the last line of its movement history is written and any open assignment is closed. Nothing undoes this.',
    ok: 'Approve disposal',
    done: 'approved',
    reasonLabel: 'Note (optional)',
  },
  reject: {
    title: 'Send this request back?',
    body: 'The asset is not retired. The request goes back to whoever raised it, with your reason on it, to correct and send again.',
    ok: 'Send back',
    done: 'sent back',
    reasonLabel: 'Reason',
    reasonRequired: true,
    danger: true,
  },
  cancel: {
    title: 'Cancel this disposal request?',
    body: 'The asset is not retired and is released for another request. The record is kept.',
    ok: 'Cancel request',
    done: 'cancelled',
    reasonLabel: 'Reason (optional)',
    danger: true,
  },
};
