/**
 * Keys for rows an editor adds. A plain module, with no React or antd, so a model that
 * makes rows (the sticker editor's) can be loaded and tested on its own.
 */
let keySeq = 0;

/** A key for a new row — unique for the page's life, never two in one millisecond. */
export const newRowKey = (prefix) => {
  keySeq += 1;
  return `${prefix}${Date.now().toString(36)}${keySeq}`;
};
