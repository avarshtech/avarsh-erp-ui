/**
 * The uploaded document being reviewed, between the upload dialog and the review page.
 *
 * Kept in memory for this tab — a File cannot be stored — and the reading plus the
 * user's edits are also written to sessionStorage, so a reload does not throw away a
 * minute of AI work. After a reload a PDF has to be attached again to be shown; the
 * spreadsheet grid travels with the reading. Nothing here reaches the server until the
 * user saves; storage failures are ignored (a private window simply keeps memory only).
 */
const KEY = 'avarsh.expdoc.templateImport.v1';

let current = null;

const persist = (draft) => {
  try {
    const { file: _file, fileUrl: _url, ...rest } = draft;
    sessionStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Quota or a blocked storage: the review still works for this tab.
  }
};

export const setImportDraft = (draft) => {
  if (current?.fileUrl) URL.revokeObjectURL(current.fileUrl);
  current = {
    ...draft,
    fileName: draft.file?.name || draft.fileName || null,
    fileUrl: draft.file ? URL.createObjectURL(draft.file) : null,
  };
  persist(current);
  return current;
};

export const getImportDraft = () => {
  if (current) return current;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) current = { ...JSON.parse(raw), file: null, fileUrl: null, restored: true };
  } catch {
    current = null;
  }
  return current;
};

/** The review page's edits, so a reload comes back to them. */
export const saveImportDocuments = (documents) => {
  if (!current) return;
  current = { ...current, documents };
  persist(current);
};

/** A PDF re-attached after a reload, so the source pane can show it again. */
export const attachImportFile = (file) => {
  if (!current) return null;
  if (current.fileUrl) URL.revokeObjectURL(current.fileUrl);
  current = { ...current, file, fileName: file.name, fileUrl: URL.createObjectURL(file), restored: false };
  return current;
};

export const clearImportDraft = () => {
  if (current?.fileUrl) URL.revokeObjectURL(current.fileUrl);
  current = null;
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};
