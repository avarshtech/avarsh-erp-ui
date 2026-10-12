// Golden tests: the cost sheet's unsaved-changes and undo rules, as they behave today (2026-10-12).
//   npx vitest run src/pages/costing/sheet/model/sheetReducer.test.js
import { describe, test, expect } from 'vitest';
import { initialSheet, isDirty, sheetReducer } from './sheetReducer';

const run = (actions, state = initialSheet()) => actions.reduce(sheetReducer, state);

describe('unsaved changes are a revision count', () => {
  test('every edit bumps the revision; a save marks the revision it sent', () => {
    const edited = run([{ type: 'ADD_ROW', section: 'overhead' }, { type: 'SET_NOTE', note: 'fabric', value: 'x' }]);
    expect(edited.rev).toBe(2);
    expect(isDirty(edited)).toBe(true);
    expect(isDirty(sheetReducer(edited, { type: 'MARK_SAVED', rev: 2 }))).toBe(false);
  });

  test('an autosave that returns after further typing leaves the sheet dirty, and never moves back', () => {
    const typedOn = run([{ type: 'SET_NOTE', note: 'fabric', value: 'a' }, { type: 'SET_NOTE', note: 'fabric', value: 'ab' }]);
    const saved = sheetReducer(typedOn, { type: 'MARK_SAVED', rev: 1 });
    expect(isDirty(saved)).toBe(true);
    expect(sheetReducer(sheetReducer(saved, { type: 'MARK_SAVED', rev: 2 }), { type: 'MARK_SAVED', rev: 1 }).savedRev).toBe(2);
  });

  test('loading, a checkpoint and an unknown action are not edits', () => {
    expect(run([{ type: 'LOAD', sheet: {} }]).rev).toBe(0);
    expect(run([{ type: 'CHECKPOINT' }]).rev).toBe(0);
    const state = initialSheet();
    expect(sheetReducer(state, { type: 'NO_SUCH_ACTION' })).toBe(state);
  });
});

describe('undo is for batches', () => {
  test('a removal can be undone; a keystroke-sized edit cannot', () => {
    const added = run([{ type: 'ADD_ROW', section: 'overhead', row: { key: 'o_x', cost: 5 } }]);
    expect(added.undo).toHaveLength(0);
    const removed = sheetReducer(added, { type: 'REMOVE_ROW', section: 'overhead', key: 'o_x' });
    expect(removed.sections.overhead).toEqual([]);
    const undone = sheetReducer(removed, { type: 'UNDO' });
    expect(undone.sections.overhead).toEqual([{ key: 'o_x', cost: 5 }]);
    expect(undone.undo).toHaveLength(0);
  });

  test('a row update re-derives its amount', () => {
    const state = run([
      { type: 'ADD_ROW', section: 'localTrim', row: { key: 'lt_x', consumption: 2, cost: 3, price: 6 } },
      { type: 'UPDATE_ROW', section: 'localTrim', key: 'lt_x', patch: { cost: 4 } },
    ]);
    expect(state.sections.localTrim[0]).toMatchObject({ cost: 4, price: 8 });
  });

  test('at most 20 undo steps are kept', () => {
    const removals = Array.from({ length: 25 }, () => ({ type: 'REMOVE_ROW', section: 'overhead', key: 'none' }));
    expect(run(removals).undo).toHaveLength(20);
  });
});
