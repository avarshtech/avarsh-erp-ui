/**
 * CR-TNA-001 derivation (FR-2) and source-event replay (FR-4/5/6/9), asserted on the mock
 * source orders. SG/26-27/1012 is the §17 worked order: replayed from its source events it
 * must land on exactly the §17.3/17.4 figures. Pure functions: no browser, no backend.
 */
import { test, expect } from '@playwright/test';
import { replayOrder, makeContext, evaluateOrder } from '../../../src/services/tna/tnaReplay.js';
import { deriveActivities } from '../../../src/services/tna/tnaDerivation.js';
import {
  seedMasterVersions, seedDurationOverrides, processSteps, seedCalendar, seedSettings,
} from '../../../src/services/tna/tnaMockMasters.js';
import { seedSourceOrders } from '../../../src/services/tna/tnaMockSources.js';

const master = seedMasterVersions().find((v) => v.status === 'ACTIVE');
const ctxAt = (asOf) => makeContext({ master, overrides: seedDurationOverrides, processSteps, calendar: seedCalendar, settings: seedSettings, asOf });
const order = (id) => seedSourceOrders.find((o) => o.id === id);
const replay = (id, asOf = '2026-10-09') => replayOrder(order(id), ctxAt(asOf));
const act = (st, code) => st.activities.find((a) => a.code === code);

// §6 / §17.2 network: code → [predecessors, duration, day type, gate]
const WORKED_NETWORK = {
  A01: [[], 0, 'WD', false], A02: [['A01'], 2, 'WD', false], A03: [['A02'], 3, 'WD', false], A04: [['A03'], 5, 'CD', true],
  A05: [['A02'], 7, 'WD', false], A06: [['A05'], 7, 'CD', true], A07: [['A04'], 1, 'WD', false], A08: [['A02'], 2, 'WD', false],
  A13: [['A07'], 18, 'CD', true], A14: [['A13'], 2, 'WD', true], A09: [['A14'], 2, 'WD', false], A10: [['A09'], 2, 'WD', false],
  A11: [['A10'], 5, 'CD', true], A12: [['A06'], 2, 'WD', false], A15: [['A12', 'A14'], 2, 'WD', false], A16: [['A11', 'A15'], 1, 'WD', true],
  A17: [['A16'], 3, 'WD', false], C01: [['A17'], 2, 'WD', false], C02: [['C01'], 3, 'WD', false], C03: [['C02'], 1, 'WD', false],
  A20: [['C03'], 9, 'WD', false], G01: [['A20'], 2, 'WD', false], G02: [['G01'], 1, 'WD', false], G03: [['G02'], 1, 'WD', false],
  A21: [['G03'], 2, 'WD', false], A22: [['A21'], 2, 'WD', false], A23: [['A22'], 1, 'WD', false], A24: [['A23'], 0, 'WD', false],
};

test.describe('CR-TNA-001 derivation and replay', () => {
  test('FR-2 — the worked order derives exactly the §17 network of 28 activities', () => {
    const src = order(1012);
    const acts = deriveActivities(
      { samples: src.samples.map((s) => ({ ...s, cycles: 1 })), cutPanel: src.cutPanel, garmentProcess: src.garmentProcess, flags: {}, orderQty: src.qty, fabricRequired: src.fabricRequired },
      { ...master, overrides: seedDurationOverrides, processSteps },
      { buyer: src.buyer, productType: src.productType },
    );
    expect(acts.map((a) => a.code).sort()).toEqual(Object.keys(WORKED_NETWORK).sort());
    acts.forEach((a) => {
      const [preds, duration, dayType, gate] = WORKED_NETWORK[a.code];
      expect.soft(a.predecessors, `${a.code} predecessors`).toEqual(preds);
      expect.soft(a.duration, `${a.code} duration`).toBe(duration);
      expect.soft(a.dayType, `${a.code} day type`).toBe(dayType);
      expect.soft(a.isGate, `${a.code} gate`).toBe(gate);
    });
  });

  test('§17.4 — replayed from source events, the worked order lands on the CR figures', () => {
    const st = replay(1012);
    const { order: o, activities } = evaluateOrder(st, ctxAt('2026-10-09'));
    expect(st.status).toBe('ACTIVE');
    expect(o.baselineDispatch).toBe('2026-11-02');
    expect(o.forecastDispatch).toBe('2026-11-23');
    expect(o.original.forecastDelay).toBe(20);
    expect(o.latest.forecastDelay).toBe(-14);
    expect(o.commitmentMovement).toBe(34);
    expect(o.latest.dispatchFloat).toBe(12);
    expect(o.latest.health).toBe('GREEN');
    expect(o.original.health).toBe('RED');
    expect(o.drivingActivity).toBe('A09');
    const a09 = activities.find((a) => a.code === 'A09');
    expect([a09.revisedTarget, a09.forecastDate, a09.overdueDays, a09.baselineVariance]).toEqual(['2026-10-03', '2026-10-12', 5, 19]);
    expect(activities.find((a) => a.code === 'A13').baselineVariance).toBe(12);
  });

  test('FR-5.6 / BR-12 — the commitment revision is a version with zero activities moved', () => {
    const v = replay(1012).versions.find((x) => x.triggerEvent === 'order.dispatch_revised');
    expect(v.activitiesMoved).toBe(0);
    expect(v.deltaDispatch).toBe(0);
    expect(v.changeType).toBe('COMMITMENT_REVISION');
  });

  test('AS-09 / FR-4.1 — the baseline is identical to the plan at activation, whatever happened after', () => {
    const st = replay(1012);
    const v1 = st.versions[0].snapshot;
    st.activities.forEach((a) => expect.soft(a.baselineDate, a.code).toBe(v1[a.code].rt));
  });

  test('AS-04 / AS-05 / FR-2.5 — process steps keep their sequence and their own scope', () => {
    const st = replay(1012);
    expect(['C01', 'C02', 'C03'].map((c) => act(st, c).name)).toEqual(['Panel Printing', 'Panel Embroidery', 'Heat Transfer']);
    expect(act(st, 'A20').predecessors).toEqual(['C03']);
    expect(act(st, 'G02').scope.colours).toEqual(['Indigo']);
    expect(act(st, 'G02').requiredQty).toBe(3100);
    expect(act(st, 'G01').requiredQty).toBe(4800);
  });

  test('AS-06 / FR-2.6 / FR-2.8 — absent steps are omitted, not zero-length, and the chain stays connected', () => {
    const noWash = replay(1018);
    expect(noWash.activities.some((a) => a.code.startsWith('G'))).toBe(false);
    expect(act(noWash, 'A21').predecessors).toEqual(['A20']);
    const noLabDip = replay(1035);
    expect(noLabDip.activities.some((a) => ['A03', 'A04'].includes(a.code))).toBe(false);
    expect(act(noLabDip, 'A07').predecessors).toEqual(['A02']);
    expect(noLabDip.activities.some((a) => a.name === 'Panel Printing')).toBe(false);
  });

  test('AS-13 / AS-14 / FR-6.9 — submitted is not dispatched; dispatch and approval are separate activities', () => {
    const st = replay(1012);
    expect(act(st, 'A09').actualDate).toBeUndefined();
    expect(act(st, 'A03').actualDate).toBe('2026-08-25');
    expect(act(st, 'A04').actualDate).toBe('2026-09-02');
  });

  test('AS-15 / FR-2.7 — a requirement reaching "Fully Used" completes nothing', () => {
    const st = replay(1012);
    expect(st.audit.some((r) => r.newValue === 'FULLY_USED')).toBe(true);
    expect(act(st, 'C01').actualDate).toBeUndefined();
  });

  test('AS-16 / FR-6.6 — a partial GRN (3,050 of 5,180 m, 100% threshold) is audited and sets no date', () => {
    const st = replay(1042);
    const a13 = act(st, 'A13');
    expect(a13.actualDate).toBeUndefined();
    expect(a13.achievedQty).toBe(3050);
    expect(st.audit.some((r) => r.activityCode === 'A13' && r.changeType === 'PARTIAL_PROGRESS')).toBe(true);
    const worked = act(replay(1012), 'A13');
    expect(worked.actualDate).toBe('2026-09-28');
    expect(worked.partials.map((p) => p.ref)).toEqual(['GRN/26-27/11610', 'GRN/26-27/11847']);
  });

  test('AS-17 / FR-9.5 — a duplicate delivery gives one actual and is counted', () => {
    const st = replay(1012);
    expect(st.duplicates).toBe(1);
    expect(st.eventLog.filter((e) => e.status === 'DUPLICATE_SUPPRESSED')).toHaveLength(1);
    expect(st.audit.filter((r) => r.activityCode === 'A13' && r.field === 'Actual')).toHaveLength(1);
  });

  test('AS-02 / AS-03 / FR-9.2 — unresolved identity or a missing BOM blocks the plan', () => {
    const identity = replay(1023);
    expect(identity.status).toBe('BLOCKED');
    expect(identity.activities).toHaveLength(0);
    expect(identity.exceptions[0]).toMatchObject({ severity: 'BLOCK', type: 'IDENTITY_UNRESOLVED', unresolvedValue: 'CP/6102/B' });
    expect(identity.eventLog.filter((e) => e.status === 'HELD').length).toBeGreaterThan(1);
    const noBom = replay(1047);
    expect(noBom.status).toBe('BLOCKED');
    expect(noBom.exceptions[0].type).toBe('MISSING_MANDATORY_INPUT');
  });

  test('AS-08 / FR-3.10 — an infeasible commitment is flagged with its shortfall; no duration is shortened', () => {
    const st = replay(1031);
    expect(st.status).toBe('INFEASIBLE');
    expect(st.generation.shortfallDays).toBeGreaterThan(0);
    expect(st.exceptions.find((x) => x.type === 'INFEASIBLE_COMMITMENT')).toBeTruthy();
    st.activities.filter((a) => a.code.startsWith('A') && a.code !== 'A07b')
      .forEach((a) => expect.soft(a.duration, a.code).toBe(master.activities.find((m) => m.code === a.masterCode).duration));
  });

  test('AS-10 / FR-1.6 / FR-4.3 — a Draft requirement gives provisional activities outside the baseline', () => {
    const st = replay(1035);
    const wash = st.activities.filter((a) => a.code.startsWith('G'));
    expect(wash).toHaveLength(2);
    wash.forEach((a) => { expect(a.provisional).toBe(true); expect(a.baselineDate).toBeNull(); });
    expect(st.exceptions.some((x) => x.type === 'PROVISIONAL_ACTIVITIES')).toBe(true);
  });

  test('AS-11 / FR-4.4 — a step added after activation is a post-baseline addendum; the original baseline is untouched', () => {
    const st = replay(1039);
    const c03 = act(st, 'C03');
    expect(c03.postBaseline).toBe(true);
    expect(c03.addendumOn).toBe('2026-09-22');
    expect(c03.baselineDate).toBeTruthy();
    const v1 = st.versions[0].snapshot;
    st.activities.filter((a) => !a.postBaseline).forEach((a) => expect.soft(a.baselineDate, a.code).toBe(v1[a.code].rt));
  });

  test('FR-5.10 / FR-7.14 — a rejected lab dip opens cycle 2; fabric PO waits on the final cycle', () => {
    const st = replay(1018);
    expect(act(st, 'A04').outcome).toBe('REJECTED');
    expect(act(st, 'A03-2').predecessors).toEqual(['A04']);
    expect(act(st, 'A04-2').predecessors).toEqual(['A03-2']);
    expect(act(st, 'A07').predecessors).toEqual(['A04-2']);
    expect(act(st, 'A04-2').notBefore).toBe('2026-10-12');
  });

  test('AS-19 / FR-7.8 / FR-5.2 — with no new events, overdue ages daily and targets hold', () => {
    const at9 = evaluateOrder(replay(1012, '2026-10-09'), ctxAt('2026-10-09'));
    const at12 = evaluateOrder(replay(1012, '2026-10-12'), ctxAt('2026-10-12'));
    const a09 = (e) => e.activities.find((a) => a.code === 'A09');
    expect(a09(at9).overdueDays).toBe(5);
    expect(a09(at12).overdueDays).toBe(7);
    expect(a09(at12).revisedTarget).toBe(a09(at9).revisedTarget);
  });
});
