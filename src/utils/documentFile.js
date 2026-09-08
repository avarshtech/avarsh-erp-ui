import { downloadFileAsBlob } from '../services/core/fileService';

/**
 * Employee documents hold one of two things in `fileUrl`.
 *
 * Rows created since documents became real uploads hold the file's UUID, which
 * has to be fetched through the API. Older rows hold whatever someone typed
 * before that - usually a link, sometimes a reference number.
 *
 * Both the employee form and the employee view render these, and when only one
 * of them was taught the difference, the view kept rendering the UUID as a link
 * href: the browser resolved it against the current path and the router read it
 * as an employee id. Keeping the rule in one place is the point of this file.
 */

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value is a stored file rather than a typed-in reference. */
export const isStoredFile = (value) => Boolean(value) && FILE_ID_PATTERN.test(value);

/** True when a legacy value is at least openable as a link. */
export const isOpenableLink = (value) =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim());

/** Fetches a stored file through the API and hands it to the browser to save. */
export const downloadStoredFile = async (fileId, fileName) => {
  const blob = await downloadFileAsBlob(fileId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
