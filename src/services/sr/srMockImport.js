/**
 * Mock buyer comment-sheet importer (PRD v3 §8.5). Produces a deterministic
 * "parse" of the uploaded Excel/PDF so the review-before-apply workflow is
 * fully demoable: High/Medium rows pre-ticked, Low/Unmapped not.
 *
 * Real phase: POST /sample-requests/{id}/comment-sheet:parse (server-side
 * parsing + OCR; AI-extraction infrastructure already exists in the backend).
 * Nothing is ever written by the parse itself — Apply only fills the form.
 */
import dayjs from 'dayjs';

const delay = (ms = 700) => new Promise((r) => setTimeout(r, ms));

export const parseCommentSheet = async (file) => {
  await delay(); // brief simulated progress (PRD NFR: real parse ≤10s w/ indicator)
  const fileName = file?.name || 'CommentSheet.xlsx';

  return {
    fileName,
    summary: '7 fields matched, 2 need your attention',
    rows: [
      {
        key: 'date', targetField: 'date', label: 'Feedback Received Date',
        value: dayjs().format('YYYY-MM-DD'),
        sourceRef: 'Sheet1!B3 — "Date of comments"', confidence: 'HIGH',
      },
      {
        key: 'from', targetField: 'from', label: 'Feedback From',
        value: 'Marieke de Vries',
        sourceRef: 'Sheet1!B4 — "Commented by"', confidence: 'HIGH',
      },
      {
        key: 'decision', targetField: 'decision', label: 'Overall Decision',
        value: 'REVISION_REQUIRED',
        sourceRef: 'Sheet1!B6 — "REVISE & RESUBMIT"', confidence: 'MEDIUM',
      },
      {
        key: 'fit', targetField: 'comments.fit', label: 'Fit Comments',
        value: 'Shoulder slope too square on 116. Armhole 1 cm tight across all sizes.',
        sourceRef: 'Sheet1!A10:A12 — "FIT"', confidence: 'HIGH',
      },
      {
        key: 'measurement', targetField: 'comments.measurement', label: 'Measurement Comments',
        value: 'Sleeve length +1.5 cm vs spec on 128. CB length within tolerance.',
        sourceRef: 'Sheet1!A14:A15 — "MEAS."', confidence: 'HIGH',
      },
      {
        key: 'fabricShade', targetField: 'comments.fabricShade', label: 'Fabric / Shade Comments',
        value: 'Shade acceptable against approved lab dip. Hand-feel slightly stiff after wash.',
        sourceRef: 'Sheet1!A17 — "FABRIC"', confidence: 'HIGH',
      },
      {
        key: 'workmanship', targetField: 'comments.workmanship', label: 'Workmanship Comments',
        value: 'Placket topstitch uneven on one piece. Button spacing to be re-checked.',
        sourceRef: 'Sheet1!A19 — "MAKE-UP"', confidence: 'HIGH',
      },
      {
        key: 'rejectionReasonCodes', targetField: 'rejectionReasonCodes', label: 'Rejection Reason Codes',
        value: ['FIT_ISSUE', 'MEASUREMENT_VARIATION'],
        sourceRef: 'Inferred from comment text — not an explicit column', confidence: 'LOW',
      },
      {
        key: 'sizesAffected', targetField: null, label: 'Sizes Affected',
        value: '116, 128',
        sourceRef: 'Sheet1!C10:C15', confidence: 'UNMAPPED',
      },
    ],
  };
};
