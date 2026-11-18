// What the packing-list workspace says about approval: why a draft came back, and the History entries.
//   npx vitest run src/pages/expdoc/packing-list/plApproval.test.js
import { describe, test, expect } from 'vitest';
import { historyItems, returnedText } from './plApproval';

const AT = '2026-11-18 10:05';

describe('returnedText: why a draft came back', () => {
  test.each([
    ['REFERRED_BACK', 'Carton 12 is short.', `Referred back by Priya S. on ${AT}: Carton 12 is short.`],
    ['REJECTED', 'Buyer cancelled the PO.', `Rejected by Priya S. on ${AT}: Buyer cancelled the PO.`],
    ['WITHDRAWN', null, `Withdrawn by Priya S. on ${AT}`],
    ['SOMETHING_NEW', 'Sent back.', `Returned by Priya S. on ${AT}: Sent back.`],
  ])('%s', (kind, reason, text) => {
    expect(returnedText({ kind, by: 'Priya S.', at: AT, reason })).toBe(text);
  });

  test('nothing returned says nothing', () => {
    expect(returnedText(null)).toBeNull();
  });
});

describe('historyItems', () => {
  const created = { createdBy: 'Ravi K.', createdAt: '2026-11-17 09:00' };
  const texts = (pl) => historyItems(pl).map((i) => i.content);

  test('a list no flow applied to is finalised at once, as before: no approval entries', () => {
    const pl = {
      ...created,
      approval: { requestId: null, submittedAt: AT, submittedBy: 'Ravi K.' },
      finalisedBy: 'Ravi K.',
      finalSnapshot: { at: AT },
    };
    expect(texts(pl)).toEqual(['Created by Ravi K. on 2026-11-17 09:00', `Finalised by Ravi K. on ${AT}`]);
  });

  test('waiting for approval: submitted', () => {
    const pl = { ...created, approval: { requestId: 7, submittedAt: AT, submittedBy: 'Ravi K.' } };
    expect(texts(pl)).toEqual(['Created by Ravi K. on 2026-11-17 09:00', `Submitted for approval by Ravi K. on ${AT}`]);
  });

  test('approved: the approver finalised it', () => {
    const pl = {
      ...created,
      approval: { requestId: 7, submittedAt: AT, submittedBy: 'Ravi K.' },
      finalisedBy: 'Priya S.',
      finalSnapshot: { at: '2026-11-18 11:00' },
    };
    expect(historyItems(pl).at(-1)).toEqual({ content: 'Approved by Priya S. on 2026-11-18 11:00', color: 'green' });
  });

  test('sent back: submitted, then the return with its reason', () => {
    const pl = {
      ...created,
      approval: { requestId: 7, submittedAt: AT, submittedBy: 'Ravi K.' },
      returned: { kind: 'REFERRED_BACK', by: 'Priya S.', at: '2026-11-18 11:00', reason: 'Recheck the weights.' },
    };
    expect(texts(pl)).toEqual([
      'Created by Ravi K. on 2026-11-17 09:00',
      `Submitted for approval by Ravi K. on ${AT}`,
      'Referred back by Priya S. on 2026-11-18 11:00: Recheck the weights.',
    ]);
  });

  test('the revision, superseded and cancelled entries stay as they were', () => {
    const pl = {
      ...created, revision: 1, reviseReason: 'Buyer moved two cartons.', supersededByPlId: 9, cancelReason: 'Order cancelled.',
    };
    expect(historyItems(pl).slice(1)).toEqual([
      { content: 'Revision 1: Buyer moved two cartons.', color: 'orange' },
      { content: 'Superseded by a later revision', color: 'gray' },
      { content: 'Cancelled: Order cancelled.', color: 'red' },
    ]);
  });
});
