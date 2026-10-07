/**
 * Daily-sheet and receipt rules (plan 1a "Daily sheet", "Receipts"). The screens run them as the
 * user types; the mock API runs them again on save, the way the server will.
 */
import { STAGE_LABEL, stageLabel } from './constants';
import { effectiveCells, receivedQty } from './snapshotRules';
import { isAfterDay, isBeforeDay } from './workingDays';

const isWhole = (v) => Number.isInteger(v) && v >= 0;

/** Why a date cannot take an entry for this job, or null. */
export const sheetDateProblem = ({ date, today, jobStart, latestEntryDate }) => {
  if (isAfterDay(date, today)) return 'The date cannot be in the future.';
  if (jobStart && isBeforeDay(date, jobStart)) return `The job started on ${jobStart}.`;
  if (latestEntryDate && isBeforeDay(date, latestEntryDate)) {
    return `A later update exists (${latestEntryDate}); this job is read-only for this date.`;
  }
  return null;
};

/** The grid a sheet opens with: the last figures raised to the received floor. */
export const prefillCells = (stages, colours, latestCells, floor) => effectiveCells(stages, colours, latestCells, floor);

/**
 * Cell errors for one job: [{ colour, stage, message }].
 * `prevCells` = the entry before the one being replaced (never-down base); `planByColour` = { stage: { colour: qty } }.
 */
export const validateJobCells = ({ stages, colours, cells, prevCells, planByColour, floor }) => {
  const errors = [];
  colours.forEach((colour) => {
    let prevStage = null;
    let prevValue = null;
    stages.forEach((stage) => {
      const raw = cells?.[colour]?.[stage];
      const v = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
      const push = (message) => errors.push({ colour, stage, message });
      if (!isWhole(v)) { push('Enter a whole number, 0 or more.'); return; }
      const before = Number(prevCells?.[colour]?.[stage]) || 0;
      if (v < before) push(`Cannot go down: the last update had ${before}.`);
      const planned = planByColour?.[stage]?.[colour] || 0;
      if (v > planned) push(`Above the plan of ${planned}.`);
      const minimum = floor?.[colour]?.[stage] || 0;
      if (v < minimum) push(`Below the ${minimum} already received.`);
      if (prevValue !== null && v > prevValue) push(`Ahead of ${STAGE_LABEL[prevStage]} (${prevValue}).`);
      prevStage = stage;
      prevValue = v;
    });
  });
  return errors;
};

/**
 * Receipt errors: [{ colour?, message }]. `lines` = [{ colour, size, good, alter, rejected, rejectSource }].
 * Good + rejected per colour at the receipt's stage cannot pass that stage's plan; alter pieces do not count;
 * rejected pieces need a reject source.
 */
export const validateReceipt = ({
  stage, stages, lines, planByColour, received, receiptDate, today, jobStart, vendorDcNo, postedDcNos = [],
}) => {
  const errors = [];
  if (!stages.includes(stage)) errors.push({ message: 'Pick one of the job\'s stages.' });
  if (!receiptDate) errors.push({ message: 'Enter the receipt date.' });
  else if (isAfterDay(receiptDate, today)) errors.push({ message: 'The receipt date cannot be in the future.' });
  else if (jobStart && isBeforeDay(receiptDate, jobStart)) errors.push({ message: `The job started on ${jobStart}.` });
  const dc = (vendorDcNo || '').trim().toUpperCase();
  if (!dc) errors.push({ message: 'Enter the vendor\'s DC number.' });
  else if (postedDcNos.map((d) => String(d).trim().toUpperCase()).includes(dc)) {
    errors.push({ message: `DC ${vendorDcNo} is already posted for this vendor.` });
  }
  const byColour = {};
  let any = false;
  (lines || []).forEach((l) => {
    ['good', 'alter', 'rejected'].forEach((k) => {
      const v = Number(l[k]) || 0;
      if (!isWhole(v)) errors.push({ colour: l.colour, message: `${l.colour} ${l.size}: enter whole numbers.` });
      if (v > 0) any = true;
    });
    if ((Number(l.rejected) || 0) > 0 && !l.rejectSource) errors.push({ colour: l.colour, message: `${l.colour} ${l.size}: say whose fault the rejects are.` });
    byColour[l.colour] = (byColour[l.colour] || 0) + (Number(l.good) || 0) + (Number(l.rejected) || 0);
  });
  if (!any) errors.push({ message: 'Enter at least one quantity.' });
  Object.entries(byColour).forEach(([colour, qty]) => {
    const planned = planByColour?.[stage]?.[colour] || 0;
    const already = receivedQty(received, stage, colour);
    if (qty + already > planned) {
      errors.push({ colour, message: `${colour}: ${already} already received + ${qty} is over the ${stageLabel(stage)} plan of ${planned}.` });
    }
  });
  return errors;
};
