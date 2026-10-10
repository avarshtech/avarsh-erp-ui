/**
 * CR-TNA-001 §17 worked example, asserted against the Time & Action engine.
 * Every expected value below is copied from the CR's tables (17.2 – 17.6) and
 * acceptance scenarios AS-20 … AS-25. Pure functions: no browser, no backend.
 */
import { test, expect } from '@playwright/test';
import { makeCalendar, isWorking, wdDiff } from '../../../src/services/tna/tnaCalendar.js';
import {
  generateBaseline, evaluatePlan, forecasts, netOrderImpact, terminalCode,
} from '../../../src/services/tna/tnaEngine.js';

const MONTHS = { Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** '16-Aug' → '2026-08-16' */
const d = (s) => { const [day, mon] = s.split('-'); return `2026-${MONTHS[mon]}-${day.padStart(2, '0')}`; };

// Mon–Sat working, Sunday off, four declared holidays in the period (§17.1, A-02).
const CAL = makeCalendar({ weeklyOff: [0], holidays: ['2026-08-26', '2026-10-02', '2026-10-20', '2026-10-21'] });
const ORDER_DATE = d('16-Aug');
const ORIGINAL = d('03-Nov');
const REVISED = d('07-Dec');
const SNAPSHOT = d('09-Oct');

// code, predecessors, duration, day type, gate — §6 dependencies, §17.2 durations.
const NETWORK = [
  ['A01', [], 0, 'WD'], ['A02', ['A01'], 2, 'WD'], ['A03', ['A02'], 3, 'WD'], ['A04', ['A03'], 5, 'CD', true],
  ['A05', ['A02'], 7, 'WD'], ['A06', ['A05'], 7, 'CD', true], ['A07', ['A04'], 1, 'WD'], ['A08', ['A02'], 2, 'WD'],
  ['A13', ['A07'], 18, 'CD', true], ['A14', ['A13'], 2, 'WD', true], ['A09', ['A14'], 2, 'WD'], ['A10', ['A09'], 2, 'WD'],
  ['A11', ['A10'], 5, 'CD', true], ['A12', ['A06'], 2, 'WD'], ['A15', ['A12', 'A14'], 2, 'WD'], ['A16', ['A11', 'A15'], 1, 'WD', true],
  ['A17', ['A16'], 3, 'WD'], ['C01', ['A17'], 2, 'WD'], ['C02', ['C01'], 3, 'WD'], ['C03', ['C02'], 1, 'WD'],
  ['A20', ['C03'], 9, 'WD'], ['G01', ['A20'], 2, 'WD'], ['G02', ['G01'], 1, 'WD'], ['G03', ['G02'], 1, 'WD'],
  ['A21', ['G03'], 2, 'WD'], ['A22', ['A21'], 2, 'WD'], ['A23', ['A22'], 1, 'WD'], ['A24', ['A23'], 0, 'WD'],
].map(([code, predecessors, duration, dayType, isGate = false]) => ({
  code, predecessors, duration, dayType, isGate, isTerminal: code === 'A24',
}));

// §17.2 — code: [baseline, latest allowable, float]
const BASELINE = {
  A01: ['16-Aug', '18-Aug', 2], A02: ['18-Aug', '20-Aug', 2], A03: ['21-Aug', '23-Aug', 1], A04: ['26-Aug', '28-Aug', 2],
  A05: ['27-Aug', '16-Sep', 17], A06: ['03-Sep', '23-Sep', 17], A07: ['27-Aug', '29-Aug', 2], A08: ['20-Aug', '03-Nov', 60],
  A13: ['14-Sep', '16-Sep', 2], A14: ['16-Sep', '18-Sep', 2], A09: ['18-Sep', '21-Sep', 2], A10: ['21-Sep', '23-Sep', 2],
  A11: ['26-Sep', '28-Sep', 1], A12: ['05-Sep', '25-Sep', 17], A15: ['18-Sep', '28-Sep', 8], A16: ['28-Sep', '29-Sep', 1],
  A17: ['01-Oct', '03-Oct', 1], C01: ['05-Oct', '06-Oct', 1], C02: ['08-Oct', '09-Oct', 1], C03: ['09-Oct', '10-Oct', 1],
  A20: ['22-Oct', '23-Oct', 1], G01: ['24-Oct', '26-Oct', 1], G02: ['26-Oct', '27-Oct', 1], G03: ['27-Oct', '28-Oct', 1],
  A21: ['29-Oct', '30-Oct', 1], A22: ['31-Oct', '02-Nov', 1], A23: ['02-Nov', '03-Nov', 1], A24: ['02-Nov', '03-Nov', 1],
};

// §17.3 — actuals captured from source by the snapshot date.
const ACTUALS = {
  A01: '16-Aug', A02: '19-Aug', A03: '25-Aug', A04: '02-Sep', A05: '31-Aug', A06: '09-Sep', A07: '03-Sep',
  A08: '24-Aug', A13: '28-Sep', A14: '30-Sep', A12: '11-Sep', A15: '01-Oct',
};

// §17.3 — code: [revised target, forecast, base var, overdue, float, status]
const SNAPSHOT_ROWS = {
  A01: ['16-Aug', '16-Aug', 0, 0, 2, 'COMPLETED_ON_TIME'], A02: ['19-Aug', '19-Aug', 1, 0, 1, 'COMPLETED_LATE'],
  A03: ['25-Aug', '25-Aug', 3, 0, -2, 'COMPLETED_LATE'], A04: ['02-Sep', '02-Sep', 6, 0, -4, 'COMPLETED_LATE'],
  A05: ['31-Aug', '31-Aug', 3, 0, 14, 'COMPLETED_LATE'], A06: ['09-Sep', '09-Sep', 5, 0, 12, 'COMPLETED_LATE'],
  A07: ['03-Sep', '03-Sep', 6, 0, -4, 'COMPLETED_LATE'], A08: ['24-Aug', '24-Aug', 3, 0, 57, 'COMPLETED_LATE'],
  A13: ['28-Sep', '28-Sep', 12, 0, -10, 'COMPLETED_LATE'], A14: ['30-Sep', '30-Sep', 12, 0, -10, 'COMPLETED_LATE'],
  A09: ['03-Oct', '12-Oct', 19, 5, -10, 'OVERDUE'], A10: ['06-Oct', '14-Oct', 19, 3, -10, 'OVERDUE'],
  A11: ['11-Oct', '19-Oct', 18, 0, -10, 'DUE_SOON'], A12: ['11-Sep', '11-Sep', 5, 0, 12, 'COMPLETED_LATE'],
  A15: ['01-Oct', '01-Oct', 11, 0, -3, 'COMPLETED_LATE'], A16: ['12-Oct', '22-Oct', 18, 0, -10, 'DUE_SOON'],
  A17: ['15-Oct', '26-Oct', 18, 0, -10, 'NOT_STARTED'], C01: ['17-Oct', '28-Oct', 18, 0, -10, 'NOT_STARTED'],
  C02: ['23-Oct', '31-Oct', 18, 0, -10, 'NOT_STARTED'], C03: ['24-Oct', '02-Nov', 18, 0, -10, 'NOT_STARTED'],
  A20: ['04-Nov', '12-Nov', 18, 0, -10, 'NOT_STARTED'], G01: ['06-Nov', '14-Nov', 18, 0, -10, 'NOT_STARTED'],
  G02: ['07-Nov', '16-Nov', 18, 0, -10, 'NOT_STARTED'], G03: ['09-Nov', '17-Nov', 18, 0, -10, 'NOT_STARTED'],
  A21: ['11-Nov', '19-Nov', 18, 0, -10, 'NOT_STARTED'], A22: ['13-Nov', '21-Nov', 18, 0, -10, 'NOT_STARTED'],
  A23: ['14-Nov', '23-Nov', 18, 0, -10, 'NOT_STARTED'], A24: ['14-Nov', '23-Nov', 18, 0, -10, 'NOT_STARTED'],
};

const withBaseline = () => {
  const gen = generateBaseline(CAL, NETWORK, ORDER_DATE, ORIGINAL);
  return NETWORK.map((a) => ({ ...a, baselineDate: gen.baseline[a.code] }));
};
const atSnapshot = () => withBaseline().map((a) => (ACTUALS[a.code] ? { ...a, actualDate: d(ACTUALS[a.code]) } : a));
const evaluate = (activities, latest, today = SNAPSHOT) => evaluatePlan({
  cal: CAL, activities, orderDate: ORDER_DATE, originalCommitment: ORIGINAL, latestCommitment: latest, today,
});

test.describe('CR-TNA-001 §17 worked example', () => {
  test('§17.2 / AS-20 — initial plan: 28 activities, earliest dispatch 02-Nov, 1 WD float, Feasible — tight', () => {
    const gen = generateBaseline(CAL, NETWORK, ORDER_DATE, ORIGINAL);
    expect(NETWORK).toHaveLength(28);
    expect(gen.earliestDispatch).toBe(d('02-Nov'));
    expect(gen.dispatchFloat).toBe(1);
    expect(gen.feasibility).toBe('FEASIBLE_TIGHT');
    for (const [code, [baseline, ls, float]] of Object.entries(BASELINE)) {
      expect.soft(gen.baseline[code], `${code} baseline`).toBe(d(baseline));
      expect.soft(gen.latestAllowable[code], `${code} latest allowable`).toBe(d(ls));
      expect.soft(wdDiff(CAL, gen.baseline[code], gen.latestAllowable[code]), `${code} float`).toBe(float);
    }
  });

  test('AS-07 — calendar-day spans non-working days; a working-day activity never lands on one', () => {
    const gen = generateBaseline(CAL, NETWORK, ORDER_DATE, ORIGINAL);
    expect(isWorking(CAL, gen.baseline.A04)).toBe(false); // 5 CD lands on the 26-Aug holiday
    NETWORK.filter((a) => a.dayType === 'WD' && a.duration > 0)
      .forEach((a) => expect.soft(isWorking(CAL, gen.baseline[a.code]), `${a.code} on a working day`).toBe(true));
  });

  test('§17.3 / AS-21 — snapshot 09-Oct: execution slipped, commitment unchanged', () => {
    const { activities, order } = evaluate(atSnapshot(), ORIGINAL);
    const byCode = Object.fromEntries(activities.map((a) => [a.code, a]));
    for (const [code, [rt, fc, baseVar, overdue, float, status]] of Object.entries(SNAPSHOT_ROWS)) {
      const a = byCode[code];
      expect.soft(a.revisedTarget, `${code} revised target`).toBe(d(rt));
      expect.soft(a.forecastDate, `${code} forecast`).toBe(d(fc));
      expect.soft(a.baselineVariance, `${code} base var`).toBe(baseVar);
      expect.soft(a.overdueDays, `${code} overdue`).toBe(overdue);
      expect.soft(a.floatDays, `${code} float`).toBe(float);
      expect.soft(a.status, `${code} status`).toBe(status);
    }
    expect(order.forecastDispatch).toBe(d('23-Nov'));
    expect(order.original.forecastDelay).toBe(20);
    expect(order.original.actualDelay).toBeNull();
    expect(order.original.openCritical).toBe(16);
    expect(order.drivingActivity).toBe('A09');
    expect(order.original.health).toBe('RED');
  });

  test('§17.4 / AS-22 / AS-23 — dispatch commitment revised to 07-Dec: nothing moves, delay is not erased', () => {
    const before = evaluate(atSnapshot(), ORIGINAL);
    const after = evaluate(atSnapshot(), REVISED);
    const moved = after.activities.filter((a, i) => a.revisedTarget !== before.activities[i].revisedTarget);
    expect(moved).toHaveLength(0);
    expect(after.order.baselineDispatch).toBe(d('02-Nov'));
    expect(after.order.commitmentMovement).toBe(34);
    expect(after.order.forecastDispatch).toBe(d('23-Nov'));
    expect(after.order.original.forecastDelay).toBe(20);
    expect(after.order.latest.forecastDelay).toBe(-14);
    expect(after.order.latest.dispatchFloat).toBe(12);
    expect(after.order.latest.openCritical).toBe(0);
    expect(after.order.latest.health).toBe('GREEN');
    expect(after.order.original.health).toBe('RED');
  });

  test('§17.5 / AS-24 — dispatch on 19-Nov: +16 against the original, −18 against the latest', () => {
    const shipped = atSnapshot().map((a) => (a.code === 'A24' ? { ...a, actualDate: d('19-Nov') } : a));
    const { order } = evaluate(shipped, REVISED, d('19-Nov'));
    expect(order.actualDispatch).toBe(d('19-Nov'));
    expect(order.original.actualDelay).toBe(16);
    expect(order.latest.actualDelay).toBe(-18);
    expect(order.commitmentMovement).toBe(34);
  });

  test('§17.6 — infeasible variant: 15-Oct commitment, shortfall 18 CD, float at receipt −12 WD, nothing shortened', () => {
    const gen = generateBaseline(CAL, NETWORK, ORDER_DATE, d('15-Oct'));
    expect(gen.earliestDispatch).toBe(d('02-Nov'));
    expect(gen.shortfallDays).toBe(18);
    expect(gen.floatAtReceipt).toBe(-12);
    expect(gen.feasibility).toBe('INFEASIBLE');
    expect(gen.baseline).toEqual(generateBaseline(CAL, NETWORK, ORDER_DATE, ORIGINAL).baseline);
  });

  test('AS-25 — two parallel slips of 3 WD: order impact comes from the network, not their sum', () => {
    const base = withBaseline().map((a) => (a.code === 'A01' ? { ...a, actualDate: ORDER_DATE } : a));
    const today = d('17-Aug');
    const before = forecasts(CAL, base, ORDER_DATE, today);
    // A05 (17 WD float) and A08 (60 WD float) each take three working days longer.
    const slipped = base.map((a) => (['A05', 'A08'].includes(a.code) ? { ...a, duration: a.duration + 3 } : a));
    const after = forecasts(CAL, slipped, ORDER_DATE, today);
    const term = terminalCode(NETWORK);
    const sumOfVariances = ['A05', 'A08'].reduce((s, c) => s + wdDiff(CAL, before[c], after[c]), 0);
    expect(sumOfVariances).toBe(6);
    expect(netOrderImpact(before[term], after[term])).toBe(0);
  });
});
