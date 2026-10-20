/**
 * A job order's progress on our own lines (plan Phase 2): cut per colour, stitched for the whole order
 * (the hourly sewing sheet has no colour), packed and returned per colour × size; its derived status,
 * projected finish and risk. Pure.
 */
import { splitBySize } from '../jobWorkTracker/pullBackRules';
import { addWorkingDays, isAfterDay, isBeforeDay } from '../jobWorkTracker/workingDays';
import { JO_STATUS, RISK } from './inwardConstants';

const add = (into, colour, qty) => { into[colour] = (into[colour] || 0) + (Number(qty) || 0); };
const total = (byColour) => Object.values(byColour || {}).reduce((a, b) => a + (Number(b) || 0), 0);

/** Daily rows [{ date, cut?, stitched, packed, rejects }] → cumulative figures and the day list. */
export const cumulativeProgress = (rows) => {
  const cut = {};
  const packed = {};
  const rejects = {};
  let stitched = 0;
  const days = [...rows].sort((a, b) => a.date.localeCompare(b.date)).map((r) => {
    Object.entries(r.cut || {}).forEach(([c, q]) => add(cut, c, q));
    Object.entries(r.packed || {}).forEach(([c, q]) => add(packed, c, q));
    Object.entries(r.rejects || {}).forEach(([c, q]) => add(rejects, c, q));
    stitched += Number(r.stitched) || 0;
    return { date: r.date, cut: total(r.cut), stitched: Number(r.stitched) || 0, packed: total(r.packed) };
  });
  return { cut, packed, rejects, stitched, days };
};

/** Per colour totals split over sizes by the order's size ratio. */
export const bySize = (byColour, jo) => Object.fromEntries(jo.colours.map(({ colour, qty }) => [colour, splitBySize(byColour[colour] || 0, qty)]));

/** [{ colour, size, qty }] → { colour: { size: qty } }. */
export const sumBySize = (lines) => (lines || []).reduce((acc, l) => {
  acc[l.colour] = acc[l.colour] || {};
  acc[l.colour][l.size] = (acc[l.colour][l.size] || 0) + (Number(l.qty) || 0);
  return acc;
}, {});

/** What is packed and not yet sent back, per colour × size. */
export const remainingBySize = (have, sent) => Object.fromEntries(Object.entries(have).map(([colour, sizes]) => [
  colour, Object.fromEntries(Object.entries(sizes).map(([size, q]) => [size, Math.max(0, q - (sent?.[colour]?.[size] || 0))])),
]));

/**
 * Derived status: waiting for material until the first issue to production, part returned from the first
 * return, all returned when good + rejected pieces reach the order qty. Closed and cancelled are stored.
 */
export const deriveStatus = ({ stored, issuedAny, goodReturned, rejectsReturned, orderQty }) => {
  if (stored === JO_STATUS.CLOSED || stored === JO_STATUS.CANCELLED) return stored;
  if (goodReturned + rejectsReturned >= orderQty && orderQty > 0) return JO_STATUS.RETURNED;
  if (goodReturned + rejectsReturned > 0) return JO_STATUS.PARTLY_RETURNED;
  return issuedAny ? JO_STATUS.IN_PRODUCTION : JO_STATUS.AWAITING_MATERIAL;
};

/** Projected finish from the average packing of the last 3 days that packed anything. */
export const projectFinish = ({ days, remaining, today }) => {
  if (remaining <= 0) return null;
  const recent = days.filter((d) => d.packed > 0).slice(-3);
  if (!recent.length) return null;
  const pace = recent.reduce((a, d) => a + d.packed, 0) / recent.length;
  return addWorkingDays(today, Math.ceil(remaining / pace));
};

/** Overdue once the due date passes with pieces still to return; at risk when the projection is later. */
export const riskOf = ({ status, dueDate, projectedDate, today }) => {
  if ([JO_STATUS.RETURNED, JO_STATUS.CLOSED, JO_STATUS.CANCELLED].includes(status) || !dueDate) return RISK.ON_TRACK;
  if (isBeforeDay(dueDate, today)) return RISK.OVERDUE;
  return projectedDate && isAfterDay(projectedDate, dueDate) ? RISK.AT_RISK : RISK.ON_TRACK;
};
