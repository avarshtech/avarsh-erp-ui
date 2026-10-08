/**
 * The carton-sticker side of the upload review, as data: a sticker's lines as the elements
 * the review asks about — named by the ids the reader's notes use, "faces:MAIN.lines:batch"
 * — the template patches that bind, remove or add a line, and what was read, in a few
 * words. reviewModel and attentionModel wire it in. No React or antd here.
 */
import { STICKER_LINE_KIND } from '../../../../utils/expDocConstants';
import {
  STICKER_READER_CATEGORIES, askKeyFor, askKeysExcept, isAskBinding,
} from '../../../../utils/expDocTemplateSchema';
import { plural } from '../../../../utils/plural';
import {
  fieldBindingChanges, newFace, newLine, nextFaceKey,
} from '../editor/sticker/stickerEditorModel';

const LINE_ID = /^faces:([^.]+)\.lines:(.+)$/;
const FIXED = 'fixed:';
const UNLABELLED = { [STICKER_LINE_KIND.SIZE_GRID]: 'Size grid', [STICKER_LINE_KIND.BARCODE]: 'Barcode' };

/** Said of a sticker line nothing fills yet: what the user can do about it. */
export const STICKER_UNBOUND_HINT = 'Choose the data to print, ask for it once per print run, or leave the space '
  + 'blank to be written in by hand.';

/** The answer "Ask when printing", as given: the bind patch makes it `ask:<key>`. */
export const ASK_WHEN_PRINTING = 'ask:';

/** "faces:MAIN.lines:batch" → { face: 'MAIN', key: 'batch' }; null for any other element. */
export const parseStickerLineId = (id) => {
  const m = LINE_ID.exec(String(id));
  return m ? { face: m[1], key: m[2] } : null;
};

const fixedTextOf = (binding) => (typeof binding === 'string' && binding.startsWith(FIXED) ? binding.slice(FIXED.length) : null);

/**
 * Every line of every face as an element of the review, named by its label (a headline by
 * its fixed text). A labelled field line can lack a data source — the reader's own rule.
 * Its `askKey` is only a hint, for display: the key "Ask when printing" would give it as
 * the template stands now. The key itself is made when the answer is given
 * (bindStickerLinePatch).
 */
export const stickerLineElements = (t = {}) => {
  const faces = t.stickerLayout?.faces || [];
  return faces.flatMap((face, fi) => (face?.lines || []).map((line, li) => {
    const kind = line.kind || STICKER_LINE_KIND.FIELD;
    const bindable = kind === STICKER_LINE_KIND.FIELD && Boolean(line.label);
    return {
      id: `faces:${face.key}.lines:${line.key}`,
      label: line.label || fixedTextOf(line.binding) || UNLABELLED[kind] || line.key,
      binding: line.binding ?? null,
      bindable,
      data: STICKER_READER_CATEGORIES,
      askKey: bindable ? askKeyFor(line.label, askKeysExcept(faces, fi, li)) : undefined,
    };
  }));
};

/** The template patch that changes the lines of one face. */
const faceLinesPatch = (t, faceKey, change) => ({
  stickerLayout: {
    ...(t.stickerLayout || {}),
    faces: (t.stickerLayout?.faces || []).map((f) => (f.key === faceKey ? { ...f, lines: change(f.lines || []) } : f)),
  },
});

export const removeStickerLinePatch = (t, { face, key }) => faceLinesPatch(t, face, (lines) => lines.filter((l) => l.key !== key));

/**
 * Bound as the sticker editor binds a line: a carton number gets its "{n} OF {N}", a pattern
 * nothing fills goes. An `ask:` answer gets its key here, from its label and the keys the
 * template's other lines hold at this moment — whatever key it came with — so a second
 * "ORDER #" is asked as orderNo2 and two questions never share one answer.
 */
export const bindStickerLinePatch = (t, { face, key }, binding) => {
  const faces = t.stickerLayout?.faces || [];
  const fi = faces.findIndex((f) => f?.key === face);
  const li = fi < 0 ? -1 : (faces[fi].lines || []).findIndex((l) => l?.key === key);
  const keyed = isAskBinding(binding) && li >= 0
    ? `ask:${askKeyFor(faces[fi].lines[li].label, askKeysExcept(faces, fi, li))}`
    : binding;
  return faceLinesPatch(t, face, (lines) => lines.map((l) => (l.key === key ? { ...l, ...fieldBindingChanges(l, keyed) } : l)));
};

/** A field line added at the end of the first face — of a new main face when the reader found none. */
export const appendStickerLinePatch = (t, { label, binding }) => {
  const faces = t.stickerLayout?.faces || [];
  const [first, ...rest] = faces.length ? faces : [newFace(nextFaceKey(faces))];
  const line = { ...newLine(STICKER_LINE_KIND.FIELD), label, binding };
  return { stickerLayout: { ...(t.stickerLayout || {}), faces: [{ ...first, lines: [...(first.lines || []), line] }, ...rest] } };
};

/** Does the sticker print anything — a face with at least one line? */
export const hasStickerLine = (t) => (t.stickerLayout?.faces || []).some((f) => f?.lines?.length);

/** ["2 faces", "12 lines", "size grid", "1 barcode"] */
export const stickerReadParts = (t) => {
  const faces = t.stickerLayout?.faces || [];
  const lines = faces.flatMap((f) => f?.lines || []);
  const barcodes = lines.filter((l) => l.kind === STICKER_LINE_KIND.BARCODE).length;
  return [
    plural(faces.length, 'face', 'faces'),
    plural(lines.length, 'line', 'lines'),
    lines.some((l) => l.kind === STICKER_LINE_KIND.SIZE_GRID) && 'size grid',
    barcodes > 0 && plural(barcodes, 'barcode', 'barcodes'),
  ].filter(Boolean);
};
