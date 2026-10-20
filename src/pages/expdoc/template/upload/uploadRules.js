/**
 * What the buyer-document upload accepts, checked in the browser before the file leaves
 * it, and the "file contains" choices. The API checks again on its side: a Word file must
 * be .docx, and a file chosen as "Carton sticker" must read like one before any AI is asked.
 */
import { DOC_TYPE } from '../../../../utils/expDocConstants';

export const ACCEPT = '.pdf,.xlsx,.xls,.docx';
export const MAX_MB = 10;
const EXTENSIONS = ACCEPT.split(',').map((ext) => ext.slice(1));

export const WRONG_TYPE = 'Upload the buyer\'s document as a PDF, an Excel file (.xlsx or .xls) or a Word file (.docx).';

/** "Let the reader decide" reads packing lists and invoices; a carton sticker has a reading of its own. */
export const CONTAINS = [
  { value: 'AUTO', label: 'Let the reader decide' },
  { value: DOC_TYPE.PACKING_LIST, label: 'Packing list' },
  { value: DOC_TYPE.INVOICE, label: 'Invoice' },
  { value: DOC_TYPE.STICKER, label: 'Carton sticker' },
];

/** Why a file cannot be read, said before it is sent anywhere — or null when it can be. */
export const fileProblem = (file) => {
  const ext = String(file?.name || '').toLowerCase().split('.').pop();
  if (!EXTENSIONS.includes(ext)) return WRONG_TYPE;
  if (!file.size) return 'The file is empty.';
  if (file.size > MAX_MB * 1024 * 1024) return `The file is larger than ${MAX_MB} MB.`;
  return null;
};

/**
 * What to upload for a choice, where it is not obvious. A sticker PDF of a whole print run
 * is hundreds of pages of one layout: one example of each is read faster and stays small.
 */
export const containsHint = (contains) => (contains === DOC_TYPE.STICKER
  ? 'One example of each sticker layout is enough — not the whole print run.'
  : null);

/** How long the reading takes, said while the user waits. */
export const readingHint = (contains) => (contains === DOC_TYPE.STICKER
  ? 'A carton sticker takes up to a minute or two.'
  : 'A packing list and invoice take up to a minute or two.');
