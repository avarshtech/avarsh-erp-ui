/**
 * Garment Process Requirement (GPR) — constants and PRD message texts.
 * PRD: Avarsh_ERP_Garment_Process_Requirement_PRD_v1.0. No approval step; the
 * lifecycle is shared with the Cut Panel Requirement (utils/requirementStatus.js).
 */
export const GPR_MODULE_ID = 'garment-process';
export const GPR_PREFIX = 'GPR';
export const GPR_PROCESS_CATEGORY = 'Garment';
export const GPR_OTHER_PROCESS_NAME = 'Other';
export const GPR_REMARKS_MAX = 500;

/** Validation texts (PRD §16). Messages name the Seq and the cell, e.g. "Seq 2: select at least one colour." */
export const GPR_VAL = {
  V1: 'Select an order.',
  V2: 'Add at least one process.',
  V3: (seq) => `Seq ${seq}: select a process.`,
  V3_OTHER: (seq) => `Seq ${seq}: name the "Other" process.`,
  V4: (seq) => `Seq ${seq}: select at least one colour.`,
  V5: (seq) => `Seq ${seq}: select at least one size.`,
  V6: (seq, color, size) => `Seq ${seq}: ${color} ${size} cannot be negative.`,
  V7_BLOCK: (seq, color, size) => `Seq ${seq}: ${color} ${size} is above its order quantity — only a user with "Submit above order qty" can submit it.`,
  V7_REASON: (seq, color, size) => `Seq ${seq}: enter a reason for ${color} ${size} being above its order quantity.`,
  V8: (seq) => `Seq ${seq}: this process is already on another line.`,
  V10: (seq) => `Seq ${seq}: the total process quantity must be more than 0.`,
};
