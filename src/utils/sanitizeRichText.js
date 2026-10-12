/**
 * Make stored rich text — the HTML the Terms & Conditions editor saves — safe to render.
 *
 * The HTML is read by Quill's clipboard, which parses it in an inert DOMParser document (nothing in
 * it runs or loads) and keeps only the formats the editor itself offers. Everything else — scripts,
 * event handlers, iframes, images, links — is dropped; the text inside a script element may survive
 * as plain, escaped text, which is harmless.
 *
 * Quill then writes the content back out in its own markup — the same HTML the editor saved — so
 * content made in the editor renders exactly as it did before it was sanitised. (Its semantic HTML
 * would draw lists and indents differently in the viewer and on the printed PO.)
 */

/** The formats RichTextEditor offers; stored HTML is reduced to these. */
export const RICH_TEXT_FORMATS = ['size', 'bold', 'italic', 'underline', 'strike', 'list', 'align', 'indent'];

/** Sanitise with an already-loaded Quill class (synchronous; for components that import Quill). */
export const sanitizeRichTextWith = (Quill, html) => {
  if (!html) return '';
  const quill = new Quill(document.createElement('div'), { formats: RICH_TEXT_FORMATS });
  quill.setContents(quill.clipboard.convert({ html: String(html) }), 'silent');
  return quill.root.innerHTML;
};

let quillLoad;

/**
 * Sanitise stored rich text, loading Quill on first use so that the print paths calling this keep it
 * out of the main bundle.
 */
export const sanitizeRichText = async (html) => {
  if (!html) return '';
  quillLoad ??= import('react-quill-new').then((m) => m.Quill);
  return sanitizeRichTextWith(await quillLoad, html);
};
